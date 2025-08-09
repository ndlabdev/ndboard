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

// ** Delete a checklist item from a card's checklist
export const cardDeleteChecklistItem = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:cardId/checklists/:checklistId/items/:itemId',
        async({ params, user, status }) => {
            const { cardId, checklistId, itemId } = params
            const userId = user.id

            // 1) Load card with deep relations for permission & archived checks
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

            // 2) Permission: user must be board/workspace member
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3) Archived guard: block destructive actions under archived entities
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot delete checklist item from archived card/list/board'
                })
            }

            // 4) Ensure checklist exists and belongs to card
            const checklist = await prisma.checklist.findUnique({
                where: {
                    id: checklistId
                },
                select: {
                    id: true, cardId: true, title: true
                }
            })
            if (!checklist) {
                return status('Not Found', {
                    code: ERROR_CODES.CARD.CHECKLIST_NOT_FOUND,
                    message: 'Checklist does not exist'
                })
            }
            if (checklist.cardId !== cardId) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.CHECKLIST_MISMATCH,
                    message: 'Checklist does not belong to the given card'
                })
            }

            // 5) Ensure item exists and belongs to checklist
            const item = await prisma.checklistItem.findUnique({
                where: {
                    id: itemId
                },
                select: {
                    id: true, checklistId: true, name: true, order: true
                }
            })
            if (!item) {
                return status('Not Found', {
                    code: ERROR_CODES.CARD.CHECKLIST_ITEM_NOT_FOUND,
                    message: 'Checklist item does not exist'
                })
            }
            if (item.checklistId !== checklistId) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.CHECKLIST_ITEM_MISMATCH,
                    message: 'Checklist item does not belong to the given checklist'
                })
            }

            try {
                // 6) Transaction: delete dependents, delete item, re-order remaining items
                await prisma.$transaction(async(tx) => {
                    // Delete completion records first (in case FK doesn't cascade)
                    await tx.checklistItemCompleted.deleteMany({
                        where: {
                            checklistItemId: itemId
                        }
                    })

                    // Delete the item
                    await tx.checklistItem.delete({
                        where: {
                            id: itemId
                        }
                    })

                    // Shift down orders for items after the deleted one
                    await tx.checklistItem.updateMany({
                        where: {
                            checklistId,
                            order: {
                                gt: item.order!
                            }
                        },
                        data: {
                            order: {
                                decrement: 1
                            }
                        }
                    })

                    // Audit logs
                    await tx.cardActivity.create({
                        data: {
                            cardId,
                            userId,
                            action: 'delete_checklist_item',
                            detail: `Deleted checklist item "${item.name}" from checklist "${checklist.title}"`
                        }
                    })

                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'delete_checklist_item',
                            detail: `Deleted checklist item "${item.name}" in card "${card.name}"`
                        }
                    })
                })

                // 7) Return standardized success payload
                return status('OK', {
                    data: {
                        id: item.id
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            params: t.Object({
                cardId: t.String(),
                checklistId: t.String(),
                itemId: t.String()
            }),
            detail: {
                tags: ['Card', 'Checklist', 'ChecklistItem'],
                summary: 'Delete a checklist item',
                description:
                    'Delete a checklist item from a checklist under a card. Requires board/workspace membership. Blocked if card/list/board is archived. Reorders remaining items to keep contiguous order.'
            }
        }
    )
