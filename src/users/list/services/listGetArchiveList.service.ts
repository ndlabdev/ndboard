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

export const listGetArchiveList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/archived',
        async({ query, status, user }) => {
            const { boardId, page = 1, pageSize = 10 } = query
            const userId = user.id

            const _page = Math.max(1, Number(page) || 1)
            const _pageSize = Math.max(1, Math.min(Number(pageSize) || 10, 50))
            const skip = (_page - 1) * _pageSize

            // Check if board exists and include workspace members for permission
            const board = await prisma.board.findUnique({
                where: {
                    id: boardId
                },
                include: {
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

            // Check if user is a member of the workspace
            const isMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            // Get total count of archived lists
            const total = await prisma.list.count({
                where: {
                    boardId,
                    isArchived: true
                }
            })

            // Get paginated archived lists
            const lists = await prisma.list.findMany({
                where: {
                    boardId,
                    isArchived: true
                },
                orderBy: {
                    order: 'asc'
                },
                skip,
                take: _pageSize
            })

            const totalPages = Math.ceil(total / _pageSize)

            return status('OK', {
                data: lists.map((l) => ({
                    id: l.id,
                    name: l.name,
                    order: l.order,
                    isFold: l.isFold,
                    createdAt: l.createdAt,
                    updatedAt: l.updatedAt
                })),
                meta: {
                    total,
                    page: _page,
                    pageSize: _pageSize,
                    totalPages
                }
            })
        },
        {
            query: t.Object({
                boardId: t.String(),
                page: t.Optional(t.String()),
                pageSize: t.Optional(t.String())
            }),
            detail: {
                tags: ['List'],
                summary: 'Get archived lists in a board (paginated)',
                description: 'Get all archived lists in a board with pagination. User must be a member of the workspace.'
            }
        }
    )
