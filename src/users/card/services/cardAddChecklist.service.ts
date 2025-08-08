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

// ** Create a new checklist in a card
export const cardAddChecklist = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:cardId/checklists',
        async({ params, body, user, status }) => {
            const { cardId } = params
            const userId = user.id
            const { title, order } = body

            // Find card with relations for permission and archived checks
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

            // Permission check: user must be board/workspace member
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Archived guard: do not allow creating checklist under archived entities
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot add checklist to archived card/list/board'
                })
            }

            try {
                // Compute order:
                // If client provides an integer order >= 0, use it;
                // otherwise append to the end (max(order)+1).
                const finalOrder =
                    typeof order === 'number'
                        ? order
                        : (await prisma.checklist.aggregate({
                            where: {
                                cardId
                            },
                            _max: {
                                order: true
                            }
                        }))._max.order !== null
                            ? ((await prisma.checklist.aggregate({
                                where: {
                                    cardId
                                },
                                _max: {
                                    order: true
                                }
                            }))._max.order as number) + 1
                            : 1

                // Create checklist
                const created = await prisma.checklist.create({
                    data: {
                        cardId,
                        title,
                        order: finalOrder
                    },
                    include: {
                        items: true
                    }
                })

                // Log to card activity (history/audit)
                await prisma.cardActivity.create({
                    data: {
                        cardId,
                        userId,
                        action: 'add_checklist',
                        detail: `Added checklist "${created.title}"`
                    }
                })

                // Optionally log to board activity for board-wide feed
                await prisma.boardActivity.create({
                    data: {
                        boardId: card.list.boardId,
                        userId,
                        action: 'add_checklist',
                        detail: `Added checklist "${created.title}" to card "${card.name}"`
                    }
                })

                return status('Created', {
                    data: {
                        id: created.id,
                        cardId: created.cardId,
                        title: created.title,
                        order: created.order,
                        createdAt: created.createdAt,
                        items: created.items
                    },
                    status: 201
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
                title: t.String({
                    minLength: 1, maxLength: 100
                }),
                order: t.Optional(t.Integer({
                    minimum: 0
                }))
            }),
            detail: {
                tags: ['Card', 'Checklist'],
                summary: 'Add a new checklist to a card',
                description:
                    'Create a new checklist under a card. Appends to the end by default (max(order)+1). Only board/workspace members can add. Operation is blocked if card/list/board is archived.'
            }
        }
    )
