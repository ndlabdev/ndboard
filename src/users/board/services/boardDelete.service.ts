// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardDelete = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:boardId',
        async ({ status, params, user, server, request, headers }) => {
            const { boardId } = params
            const userId = user.id

            // Find the board by ID
            const board = await prisma.board.findUnique({
                where: { id: boardId },
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

            try {
                // Delete the board and related logs atomically
                await prisma.$transaction([
                    prisma.board.delete({
                        where: { id: boardId }
                    }),
                    // Create an audit log for deleting the board
                    prisma.auditLog.create({
                        data: {
                            userId,
                            action: 'BOARD_DELETE',
                            description: `Deleted board "${board.name}" (id: ${boardId})`,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    // Create a board activity log for deleting the board
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId,
                            action: 'delete',
                            detail: `Deleted board "${board.name}"`
                        }
                    })
                ])

                return status('OK', {
                    message: 'Delete successfully'
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Delete board',
                description: 'Delete a board by ID. Only the board owner can delete a board. All associated resources (lists, cards, etc.) will be deleted as well.'
            }
        },
    )
