// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardArchive = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:shortLink/archive',
        async({ status, params, user, server, request, headers }) => {
            const { shortLink } = params
            const userId = user.id

            // Find the board by ID
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
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
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to archive this board'
                })
            }

            // Do not archive if already archived
            if (board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD.ALREADY_ARCHIVED,
                    message: 'Board is already archived'
                })
            }

            try {
                const boardId = board.id

                // Archive the board and set archivedAt
                const archivedBoard = await prisma.board.update({
                    where: {
                        id: boardId
                    },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        updatedById: userId
                    }
                })

                await prisma.$transaction([
                    // Create audit log and board activity for archiving the board
                    prisma.auditLog.create({
                        data: {
                            userId,
                            action: 'BOARD_ARCHIVE',
                            description: `Archived board "${board.name}" (id: ${boardId})`,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    // Create a board activity log for archived the board
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId,
                            action: 'archive',
                            detail: `Archived board "${board.name}"`
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        id: archivedBoard.id,
                        isArchived: archivedBoard.isArchived,
                        archivedAt: archivedBoard.archivedAt
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Archive board',
                description: 'Soft-delete (archive) a board by ID. Only the board owner can archive a board. Archived boards can be restored later.'
            }
        }
    )
