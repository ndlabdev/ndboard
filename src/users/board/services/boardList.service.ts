// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { Prisma } from '@prisma/client'

// ** Constants Imports
import { PAGE } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

export const boardList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/',
        async({ query, status, user }) => {
            const { workspaceId } = query
            const userId = user.id

            // Check if workspace exists and is active
            const workspace = await prisma.workspace.findUnique({
                where: {
                    id: workspaceId
                },
                include: {
                    members: true
                }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }

            // Check if user is a member of the workspace
            const isMember = workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            let boardIds: string[] | undefined

            if (query.isStarred) {
                const favorites = await prisma.boardFavorite.findMany({
                    where: {
                        userId,
                        board: {
                            workspaceId
                        }
                    },
                    select: {
                        boardId: true
                    }
                })

                boardIds = favorites.map((f) => f.boardId)
            }

            const search: Prisma.BoardWhereInput = {
                workspaceId,
                isArchived: false,
                ...(query.isStarred ? {
                    id: {
                        in: boardIds?.length ? boardIds : ['__empty__']
                    }
                } : {})
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.board.findMany({
                        take,
                        skip,
                        where: search,
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }),
                    prisma.board.count({
                        where: search
                    })
                ])

                const boardIds = data.map((b) => b.id)
                const favorites = await prisma.boardFavorite.findMany({
                    where: {
                        userId,
                        boardId: {
                            in: boardIds
                        }
                    },
                    select: {
                        boardId: true
                    }
                })
                const favoriteBoardIds = new Set(favorites.map((f) => f.boardId))

                return status('OK', {
                    data: data.map((board) => ({
                        ...board,
                        isFavorite: favoriteBoardIds.has(board.id)
                    })),
                    meta: {
                        total,
                        page,
                        pageSize,
                        totalPages: Math.ceil(total / pageSize)
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: t.Object({
                ...paginationType,
                workspaceId: t.String(),
                isStarred: t.Optional(t.Boolean())
            }),
            detail: {
                tags: ['Board'],
                summary: 'Get list of boards in workspace',
                description: 'Retrieve all boards within a specific workspace. User must be a member of the workspace. Supports pagination.'
            }
        }
    )
