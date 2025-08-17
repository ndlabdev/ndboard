// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_ROLE } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardRemoveMember = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:shortLink/members/:memberId',
        async({ status, params, user, server, request, headers }) => {
            const { shortLink, memberId } = params
            const currentUserId = user.id

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

            // Check if user to remove is the owner (cannot remove owner)
            if (board.ownerId === memberId) {
                return status('Bad Request', {
                    code: ERROR_CODES.BOARD.REMOVE_OWNER_NOT_ALLOWED,
                    message: 'Cannot remove the board owner'
                })
            }

            const boardId = board.id

            // Only owner or admin can remove member
            const currentUserBoardMember = await prisma.boardMember.findUnique({
                where: {
                    boardId_userId: {
                        boardId,
                        userId: currentUserId
                    }
                }
            })
            if (
                board.ownerId !== currentUserId &&
                (!currentUserBoardMember || currentUserBoardMember.role !== BOARD_ROLE.ADMIN)
            ) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to remove members from this board'
                })
            }

            // Check if member to remove is a board member
            const memberToRemove = await prisma.boardMember.findUnique({
                where: {
                    boardId_userId: {
                        boardId,
                        userId: memberId
                    }
                }
            })
            if (!memberToRemove) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.USER_NOT_BOARD_MEMBER,
                    message: 'This user is not a member of the board'
                })
            }

            try {
                // Count card assignments for logging
                const assignedCardsCount = await prisma.cardAssignee.count({
                    where: {
                        card: {
                            boardId
                        },
                        userId: memberId
                    }
                })

                // Transaction: remove member + unassign cards + logs
                await prisma.$transaction([
                    // Remove from board
                    prisma.boardMember.delete({
                        where: {
                            boardId_userId: {
                                boardId,
                                userId: memberId
                            }
                        }
                    }),

                    // Remove from all cards in this board
                    prisma.cardAssignee.deleteMany({
                        where: {
                            card: {
                                boardId
                            },
                            userId: memberId
                        }
                    }),

                    // Logs
                    prisma.auditLog.create({
                        data: {
                            userId: currentUserId,
                            action: 'BOARD_REMOVE_MEMBER',
                            description: `Removed user "${memberId}" from board and unassigned from ${assignedCardsCount} card(s)`,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId: currentUserId,
                            action: 'remove_member',
                            detail: `Removed user "${memberId}" and unassigned from ${assignedCardsCount} card(s)`
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        boardId,
                        userId: memberId,
                        unassignedCards: assignedCardsCount
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Remove member from board',
                description: 'Remove a member from the board by ID. Only the board owner or admin can remove members. Cannot remove the board owner.'
            }
        }
    )
