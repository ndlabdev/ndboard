// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const cardDelete = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:cardId',
        async({ status, params, user }) => {
            const { cardId } = params
            const userId = user.id

            // 1. Find card, list, board and members for permission check
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

            // 2. Permission: member of board or workspace only
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3. Only allow delete if card is archived (soft delete)
            if (!card.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.NOT_ARCHIVED,
                    message: 'Card must be archived before permanent delete'
                })
            }

            try {
                // 4. Delete card and all related data (Prisma onDelete: Cascade recommended)
                const deletedCard = await prisma.card.delete({
                    where: {
                        id: cardId
                    }
                })

                // 5. Log activity for audit/history (optional)
                await prisma.boardActivity.create({
                    data: {
                        boardId: card.list.boardId,
                        userId,
                        action: 'delete_card',
                        detail: `Deleted card "${card.name}" from list "${card.list.name}"`
                    }
                })

                return status('OK', {
                    data: {
                        id: deletedCard.id,
                        listId: deletedCard.listId,
                        boardId: deletedCard.boardId
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Card'],
                summary: 'Delete an archived card permanently',
                description: 'Permanently delete a card (must be archived first). Only board/workspace members can delete.'
            }
        }
    )
