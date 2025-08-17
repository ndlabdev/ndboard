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

export const cardUpdate = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId',
        async({ body, params, status, user }) => {
            const { cardId } = params
            const userId = user.id
            const {
                name,
                description,
                dueDate,
                order,
                labels,
                assignees,
                customFields
            } = body

            // Find card and check permissions
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

            // Check permission
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Prevent update if archived
            if (card.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.ARCHIVED,
                    message: 'Cannot update an archived card'
                })
            }

            try {
                // Transaction: update card + overwrite relations if provided
                const result = await prisma.$transaction(async(tx) => {
                    // Update card main fields
                    const updatedCard = await tx.card.update({
                        where: {
                            id: cardId
                        },
                        data: {
                            name,
                            description,
                            dueDate: dueDate ? new Date(dueDate) : undefined,
                            order: order ?? card.order
                        }
                    })

                    // Overwrite labels if provided
                    if (Array.isArray(labels)) {
                        await tx.cardLabel.deleteMany({
                            where: {
                                cardId
                            }
                        })
                        if (labels.length > 0) {
                            await tx.cardLabel.createMany({
                                data: labels.map((labelId: string) => ({
                                    cardId,
                                    labelId
                                })),
                                skipDuplicates: true
                            })
                        }
                    }

                    // Overwrite assignees if provided
                    if (Array.isArray(assignees)) {
                        await tx.cardAssignee.deleteMany({
                            where: {
                                cardId
                            }
                        })
                        if (assignees.length > 0) {
                            await tx.cardAssignee.createMany({
                                data: assignees.map((userId: string) => ({
                                    cardId,
                                    userId
                                })),
                                skipDuplicates: true
                            })
                        }
                    }

                    // Overwrite customFields if provided
                    if (Array.isArray(customFields)) {
                        await tx.cardCustomFieldValue.deleteMany({
                            where: {
                                cardId
                            }
                        })
                        if (customFields.length > 0) {
                            await tx.cardCustomFieldValue.createMany({
                                data: customFields.map((cf: { boardCustomFieldId: string; value: string }) => ({
                                    cardId,
                                    boardCustomFieldId: cf.boardCustomFieldId,
                                    value: cf.value
                                })),
                                skipDuplicates: true
                            })
                        }
                    }

                    // Log activity
                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'update_card',
                            detail: `Updated card "${updatedCard.name}"`
                        }
                    })

                    const fullCard = await tx.card.findUnique({
                        where: {
                            id: cardId
                        },
                        include: {
                            labels: {
                                include: {
                                    label: true
                                }
                            },
                            assignees: {
                                include: {
                                    user: true
                                }
                            }
                        }
                    })

                    return {
                        ...fullCard,
                        labels: fullCard?.labels.map((l) => l.label),
                        assignees: fullCard?.assignees.map((l) => ({
                            id: l.user.id,
                            name: l.user.name,
                            avatarUrl: l.user.avatarUrl
                        }))
                    }
                })

                return status('OK', {
                    data: result
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                id: t.String(),
                name: t.Optional(t.String({
                    minLength: 1, maxLength: 100
                })),
                description: t.Optional(t.Any()),
                dueDate: t.Optional(t.String({
                    format: 'date-time'
                })),
                order: t.Optional(t.Integer()),
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
                summary: 'Update card',
                description: 'Update one or many fields of a card. Only board/workspace members can update. Overwrites labels, assignees, custom fields if provided.'
            }
        }
    )
