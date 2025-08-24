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

export const boardUnfavorite = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .delete(
        '/:shortLink/favorite',
        async({ params, status, user, redis }) => {
            const { shortLink } = params
            const userId = user.id

            // Find board by shortLink, must not be archived
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

            // User must be member of workspace
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to unfavorite this board'
                })
            }

            try {
                // Remove favorite if exists
                await prisma.boardFavorite.deleteMany({
                    where: {
                        boardId: board.id,
                        userId
                    }
                })

                // Optionally log board activity
                await prisma.boardActivity.create({
                    data: {
                        boardId: board.id,
                        userId,
                        action: 'unfavorite_board',
                        detail: `Unfavorited board "${board.name}"`
                    }
                })

                // ✅ Update Redis cache
                const cacheKey = CACHE_KEYS.BOARD_LIST(board.workspaceId)
                const cached = await redis.get(cacheKey)

                if (cached) {
                    let boards = JSON.parse(cached)
                    boards = boards.map((b: { id: string }) =>
                        b.id === board.id ? {
                            ...b, isFavorite: false
                        } : b)
                    await redis.set(cacheKey, JSON.stringify(boards))
                }

                return status('OK', {
                    data: {
                        workspaceId: board.workspaceId,
                        boardId: board.id,
                        shortLink: board.shortLink,
                        userId,
                        isFavorite: false
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Unfavorite board (by shortLink)',
                description: 'Remove favorite mark from a board by shortLink. User must be a workspace member.'
            }
        }
    )
