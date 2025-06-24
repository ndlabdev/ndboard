// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardRestore = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:boardId/restore',
        async ({ status, params, user, server, request, headers }) => {
            const { boardId } = params
            const userId = user.id

            // Find the board by ID
            const board = await prisma.board.findUnique({
                where: { id: boardId }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Check permission: only owner
            if (board.ownerId !== userId) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to restore this board'
                })
            }

            // Do not archive if already archived
            if (!board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD.NOT_ARCHIVED,
                    message: 'Board is not archived'
                })
            }

            try {
                // Restore the board by setting isArchived to false and clearing archivedAt
                const restoredBoard = await prisma.board.update({
                    where: { id: boardId },
                    data: {
                        isArchived: false,
                        archivedAt: null,
                        updatedById: userId
                    }
                })

                await prisma.$transaction([
                    // Create audit log and board activity for restoring the board
                    prisma.auditLog.create({
                        data: {
                            userId,
                            action: 'BOARD_RESTORE',
                            description: `Restored board "${board.name}" (id: ${boardId})`,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    // Create a board activity log for restore the board
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId,
                            action: 'restore',
                            detail: `Restored board "${board.name}"`
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        id: restoredBoard.id,
                        isArchived: restoredBoard.isArchived,
                        archivedAt: restoredBoard.archivedAt
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Restore board',
                description: 'Restore an archived board by ID. Only the board owner can restore a board.'
            }
        }
    )
