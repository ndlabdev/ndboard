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
                    attachments: true,
                    checklists: {
                        include: {
                            items: {
                                include: {
                                    completedBy: {
                                        include: {
                                            user: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    activities: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 10
                    },
                    comments: {
                        include: {
                            user: true
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    },
                    customFieldValues: {
                        include: {
                            boardCustomField: true
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
                    dueDate: card.dueDate,
                    order: card.order,
                    isArchived: card.isArchived,
                    createdAt: card.createdAt,
                    updatedAt: card.updatedAt,
                    list: {
                        id: card.list.id,
                        name: card.list.name
                    },
                    board: {
                        id: card.list.board.id,
                        name: card.list.board.name,
                        workspaceId: card.list.board.workspace.id
                    },
                    labels: card.labels.map((cl) => cl.label),
                    assignees: card.assignees.map((a) => ({
                        id: a.user.id,
                        name: a.user.name,
                        avatarUrl: a.user.avatarUrl
                    })),
                    attachments: card.attachments,
                    checklists: card.checklists.map((chk) => ({
                        id: chk.id,
                        title: chk.title,
                        order: chk.order,
                        items: chk.items.map((item) => ({
                            id: item.id,
                            name: item.name,
                            isChecked: item.isChecked,
                            order: item.order,
                            completedBy: item.completedBy.map((cb) => ({
                                id: cb.user.id,
                                name: cb.user.name
                            }))
                        }))
                    })),
                    comments: card.comments.map((cm) => ({
                        id: cm.id,
                        content: cm.content,
                        createdAt: cm.createdAt,
                        user: {
                            id: cm.user.id,
                            name: cm.user.name,
                            avatarUrl: cm.user.avatarUrl
                        }
                    })),
                    customFields: card.customFieldValues.map((cf) => ({
                        id: cf.boardCustomField.id,
                        name: cf.boardCustomField.name,
                        value: cf.value
                    })),
                    activities: card.activities
                }
            })
        },
        {
            body: t.Object({
                listId: t.String({
                    minLength: 1
                }),
                name: t.String({
                    minLength: 1, maxLength: 100
                }),
                description: t.Optional(t.String({
                    maxLength: 255
                })),
                dueDate: t.Optional(t.String({
                    format: 'date-time'
                })),
                labels: t.Optional(t.Array(t.String())),
                assignees: t.Optional(t.Array(t.String())),
                customFields: t.Optional(t.Array(
                    t.Object({
                        boardCustomFieldId: t.String(),
                        value: t.String()
                    })
                ))
            }),
            detail: {
                tags: ['Card'],
                summary: 'Get card detail',
                description: 'Get full detail of a card, including labels, assignees, checklist, activity, comments, and custom fields. Only board/workspace members can view.'
            }
        }
    )
