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

export const boardCustomFieldCreate = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:shortLink/custom-fields',
        async({ body, params, user, status }) => {
            const { shortLink } = params
            const userId = user.id
            const { name, type, showOnCard, options } = body

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

            const isBoardMember = board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            try {
                const maxOrderField = await prisma.boardCustomField.findFirst({
                    where: {
                        boardId: board.id
                    },
                    orderBy: {
                        order: 'desc'
                    }
                })

                const nextOrder = (maxOrderField?.order ?? 0) + 1

                const field = await prisma.boardCustomField.create({
                    data: {
                        boardId: board.id,
                        name,
                        type,
                        showOnCard: showOnCard ?? false,
                        options: options ?? [],
                        order: nextOrder
                    }
                })

                return status('Created', {
                    data: field
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.String({
                    minLength: 1,
                    maxLength: 100
                }),
                type: t.String({
                    minLength: 1,
                    maxLength: 30
                }),
                showOnCard: t.Optional(t.Boolean()),
                options: t.Optional(t.Any())
            }),
            detail: {
                tags: ['BoardCustomField'],
                summary: 'Create a board custom field',
                description: 'Create a new custom field for the board. Only board/workspace members can create.'
            }
        }
    )
