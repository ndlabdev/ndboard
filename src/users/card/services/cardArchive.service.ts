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

export const cardArchive = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId/archive',
        async({ params, status, user }) => {
            const { cardId } = params
            const userId = user.id

            // Find card and check permissions
            const card = await prisma.card.findUnique({
                where: {
                    id: cardId
                },
                include: {
                    list: {
                        include: {
                            board: {
                                include: {
                                    members: true,
                                    workspace: {
                                        include: {
                                            members: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })

            if (!card) {
                return status('Not Found', {
                    code: ERROR_CODES.CARD.NOT_FOUND,
                    message: 'Card does not exist'
                })
            }

            // Check permission
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Card already archived
            if (card.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ALREADY_ARCHIVED,
                    message: 'Card has already been archived'
                })
            }

            try {
                // Update card to set isArchived = true
                await prisma.card.update({
                    where: {
                        id: cardId
                    },
                    data: {
                        isArchived: true,
                        updatedAt: new Date()
                    }
                })

                // Log activity
                await prisma.boardActivity.create({
                    data: {
                        boardId: card.list.boardId,
                        userId,
                        action: 'archive_card',
                        detail: `Archived card "${card.name}"`
                    }
                })

                return status('OK', {
                    data: {
                        id: cardId
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Card'],
                summary: 'Archive card',
                description: 'Archive a card (soft-delete). Only board/workspace members can archive. Returns error if card does not exist or already archived.'
            }
        }
    )
