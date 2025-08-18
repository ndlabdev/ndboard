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

// ** Update a checklist (rename title and/or toggle isShow)
export const cardUpdateChecklist = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId/checklists/:checklistId',
        async({ params, body, user, status }) => {
            const { cardId, checklistId } = params
            const { title, isShow } = body
            const userId = user.id

            // Load card for permission & archived checks
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

            // Permission: user must be board/workspace member
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Archived guard
            if (card.isArchived || card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot update checklist under archived card/list/board'
                })
            }

            // Ensure checklist exists & belongs to this card
            const checklist = await prisma.checklist.findUnique({
                where: {
                    id: checklistId
                },
                select: {
                    id: true, cardId: true, title: true, isShow: true, order: true, createdAt: true
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

            // Prepare changes
            const data: Record<string, any> = {}
            const logs: string[] = []

            if (typeof title !== 'undefined' && title.trim() !== checklist.title) {
                data.title = title.trim()
                logs.push(`Renamed checklist from "${checklist.title}" to "${data.title}"`)
            }
            if (typeof isShow !== 'undefined' && isShow !== checklist.isShow) {
                data.isShow = isShow
                // logs.push(`${isShow ? 'Showed' : 'Hid'} checklist`)
            }

            // If nothing effectively changes, short-circuit
            if (Object.keys(data).length === 0) {
                return status('OK', {
                    data: {
                        id: checklist.id,
                        cardId: checklist.cardId,
                        title: checklist.title,
                        isShow: checklist.isShow,
                        order: checklist.order,
                        createdAt: checklist.createdAt
                    }
                })
            }

            try {
                const updated = await prisma.$transaction(async(tx) => {
                    const res = await tx.checklist.update({
                        where: {
                            id: checklistId
                        },
                        data,
                        include: {
                            items: true
                        }
                    })

                    // Activity logs (card feed)
                    const activities = await tx.cardActivity.create({
                        data: {
                            cardId,
                            userId,
                            action: 'update_checklist',
                            detail: logs.join(' | ')
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

                    // Board-wide activity (optional)
                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'update_checklist',
                            detail: `Updated a checklist on card "${card.name}": ${logs.join(' | ')}`
                        }
                    })

                    return {
                        ...res,
                        listId: card.listId,
                        activities
                    }
                })

                return status('OK', {
                    data: {
                        id: updated.id,
                        cardId: updated.cardId,
                        listId: updated.listId,
                        title: updated.title,
                        isShow: updated.isShow,
                        order: updated.order,
                        createdAt: updated.createdAt,
                        items: updated.items,
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
                checklistId: t.String()
            }),
            body: t.Object({
                title: t.Optional(t.String({
                    minLength: 1, maxLength: 100
                })),
                isShow: t.Optional(t.Boolean())
            }),
            detail: {
                tags: ['Card', 'Checklist'],
                summary: 'Update a checklist (rename and/or toggle visibility)',
                description:
                    'Partially update a checklist under a card. Supports renaming (title) and toggling isShow. Requires board/workspace membership. Blocked if card/list/board is archived.'
            }
        }
    )
