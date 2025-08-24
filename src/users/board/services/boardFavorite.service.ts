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

export const boardFavorite = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .post(
        '/:shortLink/favorite',
        async({ params, status, user, redis }) => {
            const { shortLink } = params
            const userId = user.id

            // Find board by shortLink and check if not archived
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
                },
                include: {
                    workspace: {
                        include: {
                            members: true
                        }
                    }
                }
            })
            if (!board || board.isArchived) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Check user is a member of workspace
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to favorite this board'
                })
            }

            // Check if board is already favorited by this user
            const existing = await prisma.boardFavorite.findUnique({
                where: {
                    boardId_userId: {
                        boardId: board.id, userId
                    }
                }
            })
            if (existing) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD.ALREADY_FAVORITE,
                    message: 'Board has already been favorited'
                })
            }

            try {
                // Create favorite record
                await prisma.boardFavorite.create({
                    data: {
                        boardId: board.id,
                        userId
                    }
                })

                // Optionally log board activity
                await prisma.boardActivity.create({
                    data: {
                        boardId: board.id,
                        userId,
                        action: 'favorite_board',
                        detail: `Favorited board "${board.name}"`
                    }
                })

                // ✅ Update Redis cache
                const cacheKey = CACHE_KEYS.BOARD_LIST(board.workspaceId)
                const cached = await redis.get(cacheKey)

                if (cached) {
                    let boards = JSON.parse(cached)
                    boards = boards.map((b: { id: string }) =>
                        b.id === board.id ? {
                            ...b, isFavorite: true
                        } : b)
                    await redis.set(cacheKey, JSON.stringify(boards))
                }

                return status('Created', {
                    data: {
                        workspaceId: board.workspaceId,
                        boardId: board.id,
                        shortLink: board.shortLink,
                        userId,
                        isFavorite: true
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Mark board as favorite (by shortLink)',
                description: 'Mark a board as favorite for quick access. Find board by shortLink. User must be a member of the workspace.'
            }
        }
    )
