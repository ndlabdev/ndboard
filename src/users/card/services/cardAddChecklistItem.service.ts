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

// ** Create a new checklist item in a checklist of a card
export const cardAddChecklistItem = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:cardId/checklists/items',
        async({ params, body, user, status }) => {
            const { cardId } = params
            const userId = user.id
            const { name, checklistId, order } = body

            // Find card with deep relations for permission and archived checks
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

            // Permission check: user must be a board/workspace member
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Archived guard: do not allow creating item under archived entities
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot add checklist item to archived card/list/board'
                })
            }

            // Ensure checklist exists and belongs to the card
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

            try {
                // Compute order:
                // If client provides an integer order >= 0, use it;
                // otherwise append to the end (max(order)+1) within the same checklist.
                const maxAgg = await prisma.checklistItem.aggregate({
                    where: {
                        checklistId
                    },
                    _max: {
                        order: true
                    }
                })
                const appendOrder = maxAgg._max.order !== null ? (maxAgg._max.order as number) + 1 : 0
                const finalOrder = typeof order === 'number' && order >= 0 ? order : appendOrder

                // Create checklist item
                const created = await prisma.checklistItem.create({
                    data: {
                        checklistId,
                        name,
                        order: finalOrder,
                        isChecked: false
                    },
                    include: {
                        completedBy: true
                    }
                })

                // Log to card activity (history/audit)
                await prisma.cardActivity.create({
                    data: {
                        cardId,
                        userId,
                        action: 'add_checklist_item',
                        detail: `Added checklist item "${created.name}" to checklist "${checklist.title}"`
                    }
                })

                // Optionally log to board activity for board-wide feed
                await prisma.boardActivity.create({
                    data: {
                        boardId: card.list.boardId,
                        userId,
                        action: 'add_checklist_item',
                        detail: `Added checklist item "${created.name}" to card "${card.name}"`
                    }
                })

                return status('Created', {
                    data: {
                        id: created.id,
                        cardId,
                        checklistId: created.checklistId,
                        name: created.name,
                        isChecked: created.isChecked,
                        order: created.order,
                        completedBy: created.completedBy
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            params: t.Object({
                cardId: t.String()
            }),
            body: t.Object({
                name: t.String({
                    minLength: 1, maxLength: 100
                }),
                checklistId: t.String(),
                order: t.Optional(t.Integer({
                    minimum: 0
                }))
            }),
            detail: {
                tags: ['Card', 'Checklist', 'ChecklistItem'],
                summary: 'Add a new checklist item to a checklist',
                description:
                    'Create a new checklist item under a checklist in a card. Appends to the end by default (max(order)+1). Only board/workspace members can add. Operation is blocked if card/list/board is archived.'
            }
        }
    )
