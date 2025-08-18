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

// ** Complete/Uncomplete a checklist item in a card
export const cardCompleteChecklistItem = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId/checklists/:checklistId/items/:itemId/complete',
        async({ params, body, user, status }) => {
            const { cardId, checklistId, itemId } = params
            const { completed } = body
            const userId = user.id

            // 1) Load card (permission + archived checks)
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

            // 2) Permission: must be board/workspace member
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3) Archived guard
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot modify checklist item in archived card/list/board'
                })
            }

            // 4) Ensure checklist belongs to card
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

            // 5) Ensure item belongs to checklist
            const item = await prisma.checklistItem.findUnique({
                where: {
                    id: itemId
                },
                select: {
                    id: true, checklistId: true, name: true, isChecked: true
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
                const updated = await prisma.$transaction(async(tx) => {
                    // 6) Update item checked state
                    await tx.checklistItem.update({
                        where: {
                            id: itemId
                        },
                        data: {
                            isChecked: completed
                        },
                        include: {
                            completedBy: true
                        }
                    })

                    // 7) Maintain per-user completion record
                    if (completed) {
                        // Upsert user's completion record
                        await tx.checklistItemCompleted.upsert({
                            where: {
                                checklistItemId_userId: {
                                    checklistItemId: itemId, userId
                                }
                            },
                            update: {
                                completedAt: new Date()
                            },
                            create: {
                                checklistItemId: itemId, userId, completedAt: new Date()
                            }
                        })
                    } else {
                        // Remove current user's completion record (optional behavior)
                        await tx.checklistItemCompleted.deleteMany({
                            where: {
                                checklistItemId: itemId, userId
                            }
                        })
                    }

                    // 8) Audit logs
                    const activities = await tx.cardActivity.create({
                        data: {
                            cardId,
                            userId,
                            action: completed ? 'complete_checklist_item' : 'uncomplete_checklist_item',
                            detail: `${completed ? 'Completed' : 'Uncompleted'} checklist item "${item.name}" in "${checklist.title}"`
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    })

                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: completed ? 'complete_checklist_item' : 'uncomplete_checklist_item',
                            detail: `${completed ? 'Completed' : 'Uncompleted'} checklist item "${item.name}" on card "${card.name}"`
                        }
                    })

                    // Return fresh item with completedBy after upsert/delete
                    const fresh = await tx.checklistItem.findUnique({
                        where: {
                            id: itemId
                        },
                        include: {
                            completedBy: true
                        }
                    })
                    return {
                        ...fresh,
                        activities
                    }
                })

                return status('OK', {
                    data: {
                        id: updated.id,
                        cardId,
                        checklistId: updated.checklistId,
                        name: updated.name,
                        isChecked: updated.isChecked,
                        order: updated.order,
                        completedBy: updated.completedBy,
                        activities: updated.activities
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
            body: t.Object({
                completed: t.Boolean()
            }),
            detail: {
                tags: ['Card', 'Checklist', 'ChecklistItem'],
                summary: 'Complete/Uncomplete a checklist item',
                description:
                    'Toggle a checklist item completed state. When completed, item.isChecked=true and a per-user completion record is upserted; when uncompleted, item.isChecked=false and the current user completion record is removed. Blocked if card/list/board is archived.'
            }
        }
    )
