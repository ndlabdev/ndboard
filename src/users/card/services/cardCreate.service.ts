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

export const cardCreate = new Elysia()
    .use(authUserPlugin)
    .post(
        '/',
        async({ body, status, user }) => {
            const { listId, name, description, startDate, dueDate, labels, assignees, customFields, index } = body
            const userId = user.id

            // Find list and check permissions
            const list = await prisma.list.findUnique({
                where: {
                    id: listId
                },
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
            })
            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Check if user is member of board or workspace
            const isBoardMember = list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Check if list or board is archived
            if (list.isArchived || list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.ARCHIVED,
                    message: 'Cannot add card to archived list or board'
                })
            }

            try {
                const cards = await prisma.card.findMany({
                    where: {
                        listId
                    },
                    orderBy: {
                        order: 'asc'
                    }
                })

                const cardIds = cards.map((card) => card.id)

                let insertIdx = typeof index === 'number' && index >= 0 && index <= cards.length
                    ? index
                    : cards.length

                // Transaction: create card + optional labels, assignees, customFields
                const result = await prisma.$transaction(async(tx) => {
                    // Create card
                    const card = await tx.card.create({
                        data: {
                            listId,
                            boardId: list.boardId,
                            name,
                            description,
                            startDate: startDate === null
                                ? null
                                : startDate
                                    ? new Date(startDate)
                                    : undefined,
                            dueDate: dueDate === null
                                ? null
                                : dueDate
                                    ? new Date(dueDate)
                                    : undefined,
                            order: 0,
                            createdById: userId,
                            updatedById: userId
                        }
                    })

                    const newCardIds = [...cardIds]
                    newCardIds.splice(insertIdx, 0, card.id)

                    await Promise.all(
                        newCardIds.map((id, idx) =>
                            tx.card.update({
                                where: {
                                    id
                                },
                                data: {
                                    order: idx
                                }
                            }))
                    )

                    // Add labels if any
                    if (Array.isArray(labels) && labels.length > 0) {
                        await tx.cardLabel.createMany({
                            data: labels.map((labelId: string) => ({
                                cardId: card.id,
                                labelId
                            })),
                            skipDuplicates: true
                        })
                    }

                    // Add assignees if any
                    if (Array.isArray(assignees) && assignees.length > 0) {
                        await tx.cardAssignee.createMany({
                            data: assignees.map((userId: string) => ({
                                cardId: card.id,
                                userId
                            })),
                            skipDuplicates: true
                        })
                    }

                    // Add customFields if any
                    if (Array.isArray(customFields) && customFields.length > 0) {
                        await tx.cardCustomFieldValue.createMany({
                            data: customFields.map((cf: { boardCustomFieldId: string; value: string }) => ({
                                cardId: card.id,
                                boardCustomFieldId: cf.boardCustomFieldId,
                                value: cf.value
                            })),
                            skipDuplicates: true
                        })
                    }

                    // Log board activity
                    await tx.boardActivity.create({
                        data: {
                            boardId: list.boardId,
                            userId,
                            action: 'create_card',
                            detail: `Created card "${name}" in list "${list.name}"`
                        }
                    })

                    return card
                })

                // After transaction, fetch full card data with all relations
                const card = await prisma.card.findUnique({
                    where: {
                        id: result.id
                    },
                    include: {
                        list: true,
                        labels: {
                            include: {
                                label: true
                            }
                        },
                        assignees: {
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
                        },
                        checklists: {
                            include: {
                                items: true
                            }
                        },
                        attachments: true,
                        comments: {
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
                        },
                        customFieldValues: {
                            include: {
                                boardCustomField: true
                            }
                        }
                    }
                })

                return status('Created', {
                    data: card && {
                        id: card.id,
                        name: card.name,
                        description: card.description,
                        listId: card.listId,
                        listName: card.list?.name ?? 'Unknown',
                        boardId: card.boardId,
                        order: card.order,
                        startDate: card.startDate,
                        dueDate: card.dueDate,
                        isArchived: card.isArchived,
                        labels: card.labels.map((l) => ({
                            id: l.label.id,
                            name: l.label.name,
                            color: l.label.color
                        })),
                        assignees: card.assignees.map((a) => ({
                            id: a.user.id,
                            name: a.user.name,
                            email: a.user.email,
                            avatarUrl: a.user.avatarUrl
                        })),
                        checklists: card.checklists.map((cl) => ({
                            id: cl.id,
                            title: cl.title,
                            order: cl.order,
                            items: cl.items
                        })),
                        attachments: card.attachments,
                        comments: card.comments.map((cmt) => ({
                            id: cmt.id,
                            content: cmt.content,
                            createdAt: cmt.createdAt,
                            user: cmt.user
                        })),
                        customFieldValues: card.customFieldValues
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                listId: t.String({
                    minLength: 1
                }),
                name: t.String({
                    minLength: 1
                }),
                description: t.Optional(t.String()),
                startDate: t.Optional(t.Nullable(t.String({
                    format: 'date-time'
                }))),
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
                )),
                index: t.Optional(t.Integer({
                    minimum: 0
                }))
            }),
            detail: {
                tags: ['Card'],
                summary: 'Create a new card',
                description: 'Create a new card in a list. User must be a member of the board or workspace. Handles labels, assignees, custom fields, and logs activity.'
            }
        }
    )
