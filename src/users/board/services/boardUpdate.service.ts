// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_VISIBILITY } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'
import { CACHE_KEYS } from '@src/constants/cacheKeys'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'
import { redisPlugin } from '@src/plugins/redis'

export const boardUpdate = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .patch(
        '/:shortLink',
        async({ status, params, body, user, redis }) => {
            const { name, type, description, visibility, coverImageUrl } = body
            const { shortLink } = params
            const userId = user.id

            // Find board and include owner & workspace
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
                },
                include: {
                    workspace: true
                }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Check permission: only owner
            if (board.ownerId !== userId) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to update this board'
                })
            }

            // Check duplicate board name in workspace if name is changing
            if (name && name !== board.name) {
                const existBoard = await prisma.board.findFirst({
                    where: {
                        workspaceId: board.workspaceId,
                        name
                    }
                })
                if (existBoard) {
                    return status('Conflict', {
                        code: ERROR_CODES.BOARD.NAME_EXISTS,
                        message: 'A board with this name already exists in the workspace'
                    })
                }
            }

            try {
                const updated = await prisma.board.update({
                    where: {
                        id: board.id
                    },
                    data: {
                        name,
                        type,
                        description,
                        visibility,
                        coverImageUrl,
                        updatedById: userId
                    }
                })

                // 5. Update Redis cache in-place
                const cacheKey = CACHE_KEYS.BOARD_LIST(board.workspaceId)
                const cached = await redis.get(cacheKey)

                if (cached) {
                    let boards = JSON.parse(cached) as Array<Record<string, unknown>>
                    boards = boards.map((b) =>
                        b.id === updated.id
                            ? {
                                ...b, ...updated
                            }
                            : b)
                    await redis.set(cacheKey, JSON.stringify(boards))
                }

                return status('OK', {
                    data: updated
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.Optional(t.String({
                    minLength: 1, maxLength: 100
                })),
                description: t.Optional(t.String({
                    maxLength: 255
                })),
                type: t.Optional(t.String()),
                coverImageUrl: t.Optional(t.String()),
                visibility: t.Optional(t.Enum(BOARD_VISIBILITY))
            }),
            detail: {
                tags: ['Board'],
                summary: 'Update board',
                description: 'Update board information (name, description, visibility). Only board owner can update.'
            }
        }
    )
