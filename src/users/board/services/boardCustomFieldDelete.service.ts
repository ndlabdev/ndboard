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

export const boardCustomFieldDelete = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:shortLink/custom-fields/:fieldId',
        async({ params, user, status }) => {
            const { shortLink, fieldId } = params
            const userId = user.id

            // 1. Check if board exists and include members + workspace members
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

            // 2. Verify that user is either board member or workspace member
            const isBoardMember = board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = board.workspace.members.some(
                (m) => m.userId === userId
            )

            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3. Check if the custom field exists
            const field = await prisma.boardCustomField.findUnique({
                where: {
                    id: fieldId
                }
            })

            if (!field) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD_CUSTOM_FIELD.NOT_FOUND,
                    message: 'Custom field does not exist'
                })
            }

            // 4. Ensure the field belongs to this board
            if (field.boardId !== board.id) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD_CUSTOM_FIELD.INVALID_BOARD,
                    message: 'This custom field does not belong to the given board'
                })
            }

            try {
                // 5. Delete all related card custom field values first
                await prisma.cardCustomFieldValue.deleteMany({
                    where: {
                        boardCustomFieldId: field.id
                    }
                })

                // 6. Delete the custom field itself
                await prisma.boardCustomField.delete({
                    where: {
                        id: field.id
                    }
                })

                return status('OK', {
                    message: 'Custom field deleted successfully',
                    data: {
                        id: field.id
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            params: t.Object({
                shortLink: t.String(),
                fieldId: t.String()
            }),
            detail: {
                tags: ['BoardCustomField'],
                summary: 'Delete a board custom field',
                description:
                    'Deletes a custom field from the board. Only board/workspace members can delete. Also removes related card custom field values.'
            }
        }
    )
