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

// ** Delete a whole checklist from a card (and all nested items/completions)
export const cardDeleteChecklist = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:cardId/checklists/:checklistId',
        async({ params, user, status }) => {
            const { cardId, checklistId } = params
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
                    message: 'Cannot delete checklist from archived card/list/board'
                })
            }

            // 4) Ensure checklist exists & belongs to card
            const checklist = await prisma.checklist.findUnique({
                where: {
                    id: checklistId
                },
                select: {
                    id: true, cardId: true, title: true, order: true
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

            try {
                // 5) Transaction: delete all nested data, delete checklist, and reorder remaining checklists
                await prisma.$transaction(async(tx) => {
                    // Load all item ids under this checklist
                    const items = await tx.checklistItem.findMany({
                        where: {
                            checklistId
                        },
                        select: {
                            id: true
                        }
                    })
                    const itemIds = items.map((i) => i.id)

                    // Delete completions first (in case FK doesn't cascade)
                    if (itemIds.length > 0) {
                        await tx.checklistItemCompleted.deleteMany({
                            where: {
                                checklistItemId: {
                                    in: itemIds
                                }
                            }
                        })
                    }

                    // Delete items
                    await tx.checklistItem.deleteMany({
                        where: {
                            checklistId
                        }
                    })

                    // Delete checklist itself
                    await tx.checklist.delete({
                        where: {
                            id: checklistId
                        }
                    })

                    // Shift down orders for checklists after the deleted one (keep contiguous order)
                    await tx.checklist.updateMany({
                        where: {
                            cardId,
                            order: {
                                gt: checklist.order!
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
                            action: 'delete_checklist',
                            detail: `Deleted checklist "${checklist.title}"`
                        }
                    })

                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'delete_checklist',
                            detail: `Deleted a checklist from card "${card.name}"`
                        }
                    })
                })

                // 6) Return standardized success payload
                return status('OK', {
                    data: {
                        id: checklist.id,
                        cardId
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            params: t.Object({
                cardId: t.String(),
                checklistId: t.String()
            }),
            detail: {
                tags: ['Card', 'Checklist'],
                summary: 'Delete a checklist from a card',
                description:
                    'Delete a whole checklist (and all nested items/completions) from a card. Requires board/workspace membership. Blocked if card/list/board is archived. Remaining checklists are re-ordered to keep contiguous order.'
            }
        }
    )
