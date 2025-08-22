// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardCustomFieldList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:shortLink/custom-fields',
        async({ params, user, status }) => {
            const { shortLink } = params
            const userId = user.id

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

            const fields = await prisma.boardCustomField.findMany({
                where: {
                    boardId: board.id
                },
                orderBy: {
                    order: 'asc'
                }
            })

            return status('OK', {
                data: fields,
                meta: {
                    total: fields.length
                }
            })
        },
        {
            detail: {
                tags: ['BoardCustomField'],
                summary: 'List board custom fields',
                description: 'Get all custom fields of a board. Only board/workspace members can view.'
            }
        }
    )
