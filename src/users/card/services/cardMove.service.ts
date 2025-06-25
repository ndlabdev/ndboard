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

export const cardMove = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId/move',
        async({ body, params, status, user }) => {
            const { cardId } = params
            const userId = user.id
            const { targetListId, targetOrder } = body

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

            // Archived check
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot move archived card or card in archived list/board'
                })
            }

            // Find target list
            const targetList = await prisma.list.findUnique({
                where: {
                    id: targetListId
                },
                include: {
                    board: true
                }
            })
            if (!targetList) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'Target list does not exist'
                })
            }

            // Target list must be in the same board
            if (targetList.boardId !== card.list.boardId) {
                return status('Bad Request', {
                    code: ERROR_CODES.LIST.INVALID,
                    message: 'Target list is not in the same board'
                })
            }

            // Get number of cards in target list to validate order
            const cardsInTargetList = await prisma.card.findMany({
                where: {
                    listId: targetListId, isArchived: false
                },
                orderBy: {
                    order: 'asc'
                }
            })

            // Calculate valid target order
            let newOrder = typeof targetOrder === 'number'
                ? Math.max(1, Math.min(targetOrder, cardsInTargetList.length + 1))
                : cardsInTargetList.length + 1

            try {
                const result = await prisma.$transaction(async(tx) => {
                    // Remove card from old list (update order of old list's cards)
                    if (card.listId === targetListId) {
                        // Moving within same list: re-order all cards
                        const reorderedCards = cardsInTargetList
                            .filter((c) => c.id !== cardId)
                        reorderedCards.splice(newOrder - 1, 0, card)
                        for (let i = 0; i < reorderedCards.length; ++i) {
                            await tx.card.update({
                                where: {
                                    id: reorderedCards[i].id
                                },
                                data: {
                                    order: i + 1
                                }
                            })
                        }
                    } else {
                        // Moving to new list: update both lists' cards
                        // 1. Update order in old list (remove this card and re-order)
                        const oldListCards = await tx.card.findMany({
                            where: {
                                listId: card.listId, isArchived: false
                            },
                            orderBy: {
                                order: 'asc'
                            }
                        })
                        const oldListReorder = oldListCards
                            .filter((c) => c.id !== cardId)
                        for (let i = 0; i < oldListReorder.length; ++i) {
                            await tx.card.update({
                                where: {
                                    id: oldListReorder[i].id
                                },
                                data: {
                                    order: i + 1
                                }
                            })
                        }

                        // 2. Insert into new list at newOrder
                        const newListCards = cardsInTargetList
                        newListCards.splice(newOrder - 1, 0, card)
                        for (let i = 0; i < newListCards.length; ++i) {
                            await tx.card.update({
                                where: {
                                    id: newListCards[i].id
                                },
                                data: {
                                    order: i + 1, listId: targetListId
                                }
                            })
                        }
                        // Update moved card (order, listId)
                        await tx.card.update({
                            where: {
                                id: cardId
                            },
                            data: {
                                listId: targetListId, order: newOrder
                            }
                        })
                    }

                    // Log activity
                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'move_card',
                            detail: `Moved card "${card.name}" to list "${targetList.name}" at position ${newOrder}`
                        }
                    })

                    return true
                })

                return status('OK', {
                    data: result
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                targetListId: t.String(),
                targetOrder: t.Optional(t.Integer({
                    minimum: 1
                }))
            }),
            detail: {
                tags: ['Card'],
                summary: 'Move card to another list or reorder within a list',
                description: 'Move a card to a specific list and position in the board. Only board/workspace members can move. Handles full reordering logic.'
            }
        }
    )
