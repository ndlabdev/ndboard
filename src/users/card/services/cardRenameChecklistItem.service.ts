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

// ** Rename a checklist item
export const cardRenameChecklistItem = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId/checklists/:checklistId/items/:itemId',
        async({ params, body, user, status }) => {
            const { cardId, checklistId, itemId } = params
            const { name } = body
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

            // 2) Permission: user must be board/workspace member
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3) Archived guard: block write under archived entities
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot rename checklist item in archived card/list/board'
                })
            }

            // 4) Ensure checklist exists & belongs to card
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

            // 5) Ensure item exists & belongs to checklist
            const item = await prisma.checklistItem.findUnique({
                where: {
                    id: itemId
                },
                select: {
                    id: true, checklistId: true, name: true, order: true, isChecked: true
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

            // Short-circuit if new name equals current (optional)
            const nextName = name.trim()
            if (nextName === item.name) {
                return status('OK', {
                    data: {
                        id: item.id,
                        checklistId,
                        name: item.name,
                        isChecked: item.isChecked,
                        order: item.order
                    },
                    meta: {}
                })
            }

            try {
                // 6) Update name
                const updated = await prisma.checklistItem.update({
                    where: {
                        id: itemId
                    },
                    data: {
                        name: nextName
                    },
                    include: {
                        completedBy: true
                    }
                })

                // 7) Audit logs
                await prisma.cardActivity.create({
                    data: {
                        cardId,
                        userId,
                        action: 'rename_checklist_item',
                        detail: `Renamed checklist item from "${item.name}" to "${updated.name}" in "${checklist.title}"`
                    }
                })
                await prisma.boardActivity.create({
                    data: {
                        boardId: card.list.boardId,
                        userId,
                        action: 'rename_checklist_item',
                        detail: `Renamed checklist item on card "${card.name}"`
                    }
                })

                // 8) Return standardized payload
                return status('OK', {
                    data: {
                        id: updated.id,
                        checklistId: updated.checklistId,
                        name: updated.name,
                        isChecked: updated.isChecked,
                        order: updated.order,
                        completedBy: updated.completedBy
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
                name: t.String({
                    minLength: 1, maxLength: 100
                })
            }),
            detail: {
                tags: ['Card', 'Checklist', 'ChecklistItem'],
                summary: 'Rename a checklist item',
                description:
                    'Rename an existing checklist item under a checklist. Requires board/workspace membership. Blocked if card/list/board is archived.'
            }
        }
    )
