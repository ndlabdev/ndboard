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

export const boardTransferOwner = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:boardId/transfer-owner',
        async({ status, body, params, user, server, request, headers }) => {
            const { boardId } = params
            const { newOwnerId } = body
            const userId = user.id

            // Find the board by ID
            const board = await prisma.board.findUnique({
                where: {
                    id: boardId
                },
                include: {
                    workspace: {
                        include: {
                            members: true
                        }
                    }
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
                    message: 'You do not have permission to transfer ownership of this board'
                })
            }

            // Cannot transfer to the current owner
            if (newOwnerId === userId) {
                return status('Bad Request', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'Cannot transfer ownership to the current owner'
                })
            }

            // Check if the new owner is a member of the workspace
            const isMember = board.workspace.members.some((member) => member.userId === newOwnerId)
            if (!isMember) {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'The new owner must be a member of the same workspace'
                })
            }

            // Lookup user names for current and new owner
            const [currentUser, newOwner] = await Promise.all([
                prisma.user.findUnique({
                    where: {
                        id: userId
                    },
                    select: {
                        name: true
                    }
                }),
                prisma.user.findUnique({
                    where: {
                        id: newOwnerId
                    },
                    select: {
                        name: true
                    }
                })
            ])

            try {
                // Update the board owner
                const updatedBoard = await prisma.board.update({
                    where: {
                        id: boardId
                    },
                    data: {
                        ownerId: newOwnerId,
                        updatedById: userId
                    }
                })

                // Build human-readable log message
                const detail = currentUser && newOwner
                    ? `${currentUser.name} transferred board ownership to ${newOwner.name}`
                    : `Transferred board ownership to user "${newOwnerId}"`

                // Create audit log and board activity for transferring ownership
                await prisma.$transaction([
                    prisma.auditLog.create({
                        data: {
                            userId,
                            action: 'BOARD_TRANSFER_OWNER',
                            description: detail,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId,
                            action: 'transfer_owner',
                            detail
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        id: updatedBoard.id,
                        ownerId: updatedBoard.ownerId
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                newOwnerId: t.String()
            }),
            detail: {
                tags: ['Board'],
                summary: 'Transfer board ownership',
                description: 'Transfer ownership of a board to another member of the same workspace. Only the current owner can transfer ownership.'
            }
        }
    )
