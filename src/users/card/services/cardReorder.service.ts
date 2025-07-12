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

export const cardReorder = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/reorder',
        async({ body, status, user }) => {
            const userId = user.id
            const { id, listId, order } = body

            // Find the card and related entities for permission checking
            const card = await prisma.card.findUnique({
                where: {
                    id
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

            // Check if user is a member of the board or workspace
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Do not allow reorder in archived lists or boards
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot reorder archived card or card in archived list/board'
                })
            }

            try {
                await prisma.$transaction(async(tx) => {
                    // Update card's order and listId (move to new list if changed)
                    await tx.card.update({
                        where: {
                            id
                        },
                        data: {
                            order, listId
                        }
                    })

                    // Log reorder/move action to BoardActivity (optional but good for audit/history)
                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'reorder_card',
                            detail: `Reordered card "${card.name}" to order ${order} in list ${listId}`
                        }
                    })

                    // Fetch all cards in the target list after move/reorder, sorted by new order
                    const allCards = await tx.card.findMany({
                        where: {
                            listId
                        },
                        orderBy: {
                            order: 'asc'
                        }
                    })

                    // Check if the minimum gap between orders is too small (float precision problem)
                    //    If so, normalize order for the whole list to avoid float collision
                    let minDiff = Number.POSITIVE_INFINITY
                    for (let i = 1; i < allCards.length; i++) {
                        const diff = Math.abs(allCards[i].order - allCards[i - 1].order)
                        if (diff < minDiff) minDiff = diff
                    }
                    // If minDiff < 1e-5 (too close), normalize all orders to consecutive integers (1, 2, 3, ...)
                    if (minDiff < 1e-5) {
                        for (let i = 0; i < allCards.length; i++) {
                            await tx.card.update({
                                where: {
                                    id: allCards[i].id
                                },
                                data: {
                                    order: i + 1
                                }
                            })
                        }
                    }
                })

                return status('OK', {
                    data: true,
                    message: 'Card reorder successfully!'
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                id: t.String(),
                listId: t.String(),
                order: t.Number()
            }),
            detail: {
                tags: ['Card'],
                summary: 'Reorder or move a card using float order (auto-normalize)',
                description: 'Move or reorder a card in a board using float order. Automatically normalizes the order if values become too close. Only board/workspace members can perform this action.'
            }
        }
    )
