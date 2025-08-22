// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardCustomFieldUpdate = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:shortLink/custom-fields/:fieldId',
        async({ body, params, user, status }) => {
            const { shortLink, fieldId } = params
            const userId = user.id
            const { name, type, showOnCard, options } = body

            // 1. Validate board existence
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
                },
                include: {
                    members: true,
                    workspace: {
                        include: {
                            members: true
                        }
                    }
                }
            })

            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // 2. Check permissions: must be a member of the board or its workspace
            const isBoardMember = board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3. Ensure custom field exists
            const field = await prisma.boardCustomField.findUnique({
                where: {
                    id: fieldId
                }
            })

            if (!field || field.boardId !== board.id) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD_CUSTOM_FIELD.NOT_FOUND,
                    message: 'Custom field not found in this board'
                })
            }

            try {
                // 4. Check for duplicate field name (must be unique per board)
                if (name && name !== field.name) {
                    const duplicate = await prisma.boardCustomField.findFirst({
                        where: {
                            boardId: board.id,
                            name
                        }
                    })
                    if (duplicate) {
                        return status('Conflict', {
                            code: ERROR_CODES.BOARD_CUSTOM_FIELD.DUPLICATE,
                            message: 'A custom field with this name already exists in the board'
                        })
                    }
                }

                // 5. Perform the update
                const updatedField = await prisma.boardCustomField.update({
                    where: {
                        id: fieldId
                    },
                    data: {
                        name,
                        type,
                        showOnCard: showOnCard ?? false,
                        options: options ?? []
                    }
                })

                // 6. Return the updated field
                return status('OK', {
                    data: updatedField
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.Optional(
                    t.String({
                        minLength: 1, maxLength: 100
                    })
                ),
                type: t.Optional(
                    t.String({
                        minLength: 1, maxLength: 30
                    })
                ),
                showOnCard: t.Optional(t.Boolean()),
                options: t.Optional(
                    t.Array(
                        t.Object({
                            id: t.String(),
                            label: t.String(),
                            color: t.String()
                        })
                    )
                )
            }),
            detail: {
                tags: ['BoardCustomField'],
                summary: 'Update a board custom field',
                description:
                    'Update a custom field for the board. Only board/workspace members can update. Field name must be unique per board.'
            }
        }
    )
