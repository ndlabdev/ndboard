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

export const boardFavorite = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:shortLink/favorite',
        async({ params, status, user }) => {
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
