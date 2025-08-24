// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'
import { CACHE_KEYS } from '@src/constants/cacheKeys'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'
import { redisPlugin } from '@src/plugins/redis'

export const boardList = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .get(
        '/',
        async({ query, status, user, redis }) => {
            const { workspaceId } = query
            const userId = user.id

            // 1. Check workspace & membership
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

            const isMember = workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            const cacheKey = CACHE_KEYS.BOARD_LIST(workspaceId)

            try {
                // 2. Try get from Redis
                const cached = await redis.get(cacheKey)
                if (cached) {
                    const boards = JSON.parse(cached)
                    return status('OK', {
                        data: boards,
                        meta: {
                            total: boards.length,
                            page: 1,
                            pageSize: 100,
                            totalPages: 1
                        }
                    })
                }

                // 3. Cache miss → query DB
                const boardsFromDb = await prisma.board.findMany({
                    where: {
                        workspaceId,
                        isArchived: false
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                })

                const favorites = await prisma.boardFavorite.findMany({
                    where: {
                        userId,
                        boardId: {
                            in: boardsFromDb.map((b) => b.id)
                        }
                    },
                    select: {
                        boardId: true
                    }
                })
                const favSet = new Set(favorites.map((f) => f.boardId))

                const result = boardsFromDb.map((board) => ({
                    ...board,
                    isFavorite: favSet.has(board.id)
                }))

                // 4. Save to Redis
                await redis.set(cacheKey, JSON.stringify(result))

                return status('OK', {
                    data: result,
                    meta: {
                        total: result.length,
                        page: 1,
                        pageSize: 100,
                        totalPages: 1
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: t.Object({
                workspaceId: t.String()
            }),
            detail: {
                tags: ['Board'],
                summary: 'Get board list in workspace (with Redis cache)',
                description: 'Return all boards in a workspace with { data, meta }. Supports favorites. Cached in Redis.'
            }
        }
    )
