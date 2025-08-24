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

export const cardDetail = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:cardId',
        async({ params, status, user }) => {
            const { cardId } = params
            const userId = user.id

            // Find card with all relations needed for permission and details
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
                    },
                    labels: {
                        include: {
                            label: true
                        }
                    },
                    assignees: {
                        include: {
                            user: true
                        }
                    },
                    checklists: {
                        select: {
                            id: true,
                            title: true,
                            isShow: true,
                            items: {
                                select: {
                                    id: true,
                                    isChecked: true,
                                    name: true
                                }
                            }
                        }
                    },
                    attachments: true,
                    customFieldValues: {
                        include: {
                            boardCustomField: true
                        }
                    },
                    comments: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        select: {
                            id: true,
                            content: true,
                            createdAt: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    },
                    activities: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        select: {
                            id: true,
                            action: true,
                            detail: true,
                            createdAt: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatarUrl: true
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

            // Check if user is member of board or workspace
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            return status('OK', {
                data: {
                    id: card.id,
                    name: card.name,
                    description: card.description,
                    listId: card.listId,
                    startDate: card.startDate,
                    dueDate: card.dueDate,
                    order: card.order,
                    isArchived: card.isArchived,
                    createdAt: card.createdAt,
                    updatedAt: card.updatedAt,
                    labels: card.labels.map((l) => l.label),
                    assignees: card.assignees.map((a) => ({
                        id: a.user.id,
                        name: a.user.name,
                        email: a.user.email,
                        avatarUrl: a.user.avatarUrl
                    })),
                    checklists: card.checklists,
                    checklistCount: card.checklists.length,
                    attachments: card.attachments,
                    customFields: card.customFieldValues.map((cf) => ({
                        id: cf.boardCustomField.id,
                        name: cf.boardCustomField.name,
                        value: cf.value
                    })),
                    comments: card.comments.map((c) => ({
                        id: c.id,
                        content: c.content,
                        createdAt: c.createdAt,
                        user: c.user
                    })),
                    activities: card.activities.map((act) => ({
                        id: act.id,
                        action: act.action,
                        detail: act.detail,
                        createdAt: act.createdAt,
                        user: act.user
                    }))
                }
            })
        },
        {
            detail: {
                tags: ['Card'],
                summary: 'Get card detail',
                description: 'Get full detail of a card, including labels, assignees, checklist, activity, comments, and custom fields. Only board/workspace members can view.'
            }
        }
    )
