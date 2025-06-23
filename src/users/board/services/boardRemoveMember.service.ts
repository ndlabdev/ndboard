// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { BOARD_ROLE } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardRemoveMember = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:boardId/members/:memberId',
        async ({ status, params, user, server, request, headers }) => {
            const { boardId, memberId } = params
            const currentUserId = user.id

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

            // Check if user to remove is the owner (cannot remove owner)
            if (board.ownerId === memberId) {
                return status('Bad Request', {
                    code: ERROR_CODES.BOARD.REMOVE_OWNER_NOT_ALLOWED,
                    message: 'Cannot remove the board owner'
                })
            }

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
                // Remove member from board
                await prisma.boardMember.delete({
                    where: {
                        boardId_userId: {
                            boardId,
                            userId: memberId
                        }
                    }
                })

                // Lookup names for logging
                const [actor, removed] = await Promise.all([
                    prisma.user.findUnique({ where: { id: currentUserId }, select: { name: true } }),
                    prisma.user.findUnique({ where: { id: memberId }, select: { name: true } })
                ])

                const detail = actor && removed
                    ? `${actor.name} removed ${removed.name} from the board`
                    : `Removed user "${memberId}" from the board`

                // Log audit and activity
                await prisma.$transaction([
                    prisma.auditLog.create({
                        data: {
                            userId: currentUserId,
                            action: 'BOARD_REMOVE_MEMBER',
                            description: detail,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId: currentUserId,
                            action: 'remove_member',
                            detail
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        boardId,
                        userId: memberId
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Remove member from board',
                description: 'Remove a member from the board by ID. Only the board owner or admin can remove members. Cannot remove the board owner.'
            }
        },
    )
