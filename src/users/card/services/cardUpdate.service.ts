// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { Prisma } from '@prisma/client'

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
                startDate,
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
                            order: order ?? card.order
                        }
                    })

                    const activities: Prisma.BoardActivityCreateManyInput[] = []
                    // Compare name
                    if (name && name !== card.name) {
                        activities.push({
                            boardId: card.list.boardId,
                            userId,
                            action: 'update_card_name',
                            detail: `Changed card name from "${card.name}" to "${name}"`
                        })
                    }

                    // Compare description
                    if (description && description !== card.description) {
                        activities.push({
                            boardId: card.list.boardId,
                            userId,
                            action: 'update_card_description',
                            detail: 'Updated card description'
                        })
                    }

                    // Compare startDate
                    if (startDate !== undefined) {
                        if (startDate === null && card.startDate) {
                            activities.push({
                                boardId: card.list.boardId,
                                userId,
                                action: 'remove_start_date',
                                detail: 'Removed start date'
                            })
                        } else if (startDate && (!card.startDate || new Date(startDate).getTime() !== card.startDate.getTime())) {
                            activities.push({
                                boardId: card.list.boardId,
                                userId,
                                action: 'update_start_date',
                                detail: `Set start date to ${new Date(startDate).toISOString()}`
                            })
                        }
                    }

                    // Compare dueDate
                    if (dueDate !== undefined) {
                        if (dueDate === null && card.dueDate) {
                            activities.push({
                                boardId: card.list.boardId,
                                userId,
                                action: 'remove_due_date',
                                detail: 'Removed due date'
                            })
                        } else if (dueDate && (!card.dueDate || new Date(dueDate).getTime() !== card.dueDate.getTime())) {
                            activities.push({
                                boardId: card.list.boardId,
                                userId,
                                action: 'update_due_date',
                                detail: `Set due date to ${new Date(dueDate).toISOString()}`
                            })
                        }
                    }

                    // Compare labels
                    if (Array.isArray(labels)) {
                        const oldLabels = await tx.cardLabel.findMany({
                            where: {
                                cardId
                            },
                            include: {
                                label: true
                            }
                        })
                        const oldLabelIds = oldLabels.map((l) => l.labelId)

                        const added = labels.filter((l) => !oldLabelIds.includes(l))
                        const removed = oldLabelIds.filter((l) => !labels.includes(l))

                        // Added labels
                        if (added.length > 0) {
                            const addedLabels = await tx.boardLabel.findMany({
                                where: {
                                    id: {
                                        in: added
                                    }
                                }
                            })
                            addedLabels.forEach((lbl) => {
                                activities.push({
                                    boardId: card.list.boardId,
                                    userId,
                                    action: 'add_label',
                                    detail: `Added label "${lbl.name}" (${lbl.color}/${lbl.tone})`
                                })
                            })
                        }

                        // Removed labels
                        if (removed.length > 0) {
                            const removedLabels = oldLabels.filter((l) => removed.includes(l.labelId))
                            removedLabels.forEach((lbl) => {
                                activities.push({
                                    boardId: card.list.boardId,
                                    userId,
                                    action: 'remove_label',
                                    detail: `Removed label "${lbl.label.name}" (${lbl.label.color}/${lbl.label.tone})`
                                })
                            })
                        }
                    }

                    // Compare assignees
                    if (Array.isArray(assignees)) {
                        const oldAssignees = await tx.cardAssignee.findMany({
                            where: {
                                cardId
                            },
                            include: {
                                user: true
                            }
                        })
                        const oldIds = oldAssignees.map((a) => a.userId)

                        const added = assignees.filter((u) => !oldIds.includes(u))
                        const removed = oldIds.filter((u) => !assignees.includes(u))

                        if (added.length > 0) {
                            const addedUsers = await tx.user.findMany({
                                where: {
                                    id: {
                                        in: added
                                    }
                                }
                            })
                            addedUsers.forEach((u) => {
                                activities.push({
                                    boardId: card.list.boardId,
                                    userId,
                                    action: 'add_member',
                                    detail: `Assigned member "${u.name}" (${u.email})`
                                })
                            })
                        }

                        if (removed.length > 0) {
                            const removedUsers = oldAssignees.filter((a) => removed.includes(a.userId))
                            removedUsers.forEach((a) => {
                                activities.push({
                                    boardId: card.list.boardId,
                                    userId,
                                    action: 'remove_member',
                                    detail: `Removed member "${a.user.name}" (${a.user.email})`
                                })
                            })
                        }
                    }

                    // Custom fields
                    if (Array.isArray(customFields)) {
                        const oldCustoms = await tx.cardCustomFieldValue.findMany({
                            where: {
                                cardId
                            },
                            include: {
                                boardCustomField: true
                            }
                        })

                        const formatValue = (
                            fieldType: string,
                            raw: any,
                            options?: { id: string; label: string; color: string }[]
                        ): string => {
                            if (!raw) return ''

                            switch (fieldType) {
                                case 'date': {
                                    if (!raw) return ''
                                    const d = new Date(raw)
                                    if (isNaN(d.getTime())) return raw

                                    const day = d.getDate().toString().padStart(2, '0')
                                    const monthNames = [
                                        'Jan',
                                        'Feb',
                                        'Mar',
                                        'Apr',
                                        'May',
                                        'Jun',
                                        'Jul',
                                        'Aug',
                                        'Sep',
                                        'Oct',
                                        'Nov',
                                        'Dec'
                                    ]
                                    const month = monthNames[d.getMonth()]
                                    const year = d.getFullYear()

                                    const hh = d.getHours().toString().padStart(2, '0')
                                    const mm = d.getMinutes().toString().padStart(2, '0')

                                    return `${day} ${month} ${year} ${hh}:${mm}`
                                }
                                case 'checkbox':
                                    return raw === 'true' ? 'Yes' : 'No'
                                case 'select': {
                                    const opt = options?.find((o) => o.id === raw)
                                    return opt ? opt.label : raw
                                }
                                default:
                                    return raw
                            }
                        }

                        for (const cf of customFields) {
                            const old = oldCustoms.find(
                                (o) => o.boardCustomFieldId === cf.boardCustomFieldId
                            )

                            const fieldMeta = old?.boardCustomField
                            if (!fieldMeta) continue

                            const fieldName = fieldMeta.name
                            const oldDisplay = old ? formatValue(fieldMeta.type, old.value, fieldMeta.options as any) : ''
                            const newDisplay = formatValue(fieldMeta.type, cf.value, fieldMeta.options as any)

                            if (!old && cf.value) {
                                activities.push({
                                    boardId: card.list.boardId,
                                    userId,
                                    action: 'add_custom_field_value',
                                    detail: `Set custom field "${fieldName}" to "${newDisplay}"`
                                })
                            } else if (old && cf.value !== old.value) {
                                if (!cf.value) {
                                    activities.push({
                                        boardId: card.list.boardId,
                                        userId,
                                        action: 'remove_custom_field_value',
                                        detail: `Removed value of custom field "${fieldName}"`
                                    })
                                } else {
                                    activities.push({
                                        boardId: card.list.boardId,
                                        userId,
                                        action: 'update_custom_field_value',
                                        detail: `Changed custom field "${fieldName}" from "${oldDisplay}" to "${newDisplay}"`
                                    })
                                }
                            }

                            await tx.cardCustomFieldValue.upsert({
                                where: {
                                    cardId_boardCustomFieldId: {
                                        cardId,
                                        boardCustomFieldId: cf.boardCustomFieldId
                                    }
                                },
                                update: {
                                    value: cf.value
                                },
                                create: {
                                    cardId,
                                    boardCustomFieldId: cf.boardCustomFieldId,
                                    value: cf.value
                                }
                            })
                        }
                    }

                    // Bulk insert all logs
                    if (activities.length > 0) {
                        await tx.boardActivity.createMany({
                            data: activities
                        })

                        await tx.cardActivity.createMany({
                            data: activities.map((a) => ({
                                cardId: cardId,
                                userId: a.userId,
                                action: a.action,
                                detail: a.detail
                            }))
                        })
                    }

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
                        for (const cf of customFields) {
                            await tx.cardCustomFieldValue.upsert({
                                where: {
                                    cardId_boardCustomFieldId: {
                                        cardId,
                                        boardCustomFieldId: cf.boardCustomFieldId
                                    }
                                },
                                update: {
                                    value: cf.value
                                },
                                create: {
                                    cardId,
                                    boardCustomFieldId: cf.boardCustomFieldId,
                                    value: cf.value
                                }
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
                            list: true,
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
                                },
                                orderBy: {
                                    createdAt: 'desc'
                                }
                            },
                            customFieldValues: {
                                include: {
                                    boardCustomField: true
                                }
                            },
                            activities: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            avatarUrl: true
                                        }
                                    }
                                },
                                orderBy: {
                                    createdAt: 'desc'
                                }
                            }
                        }
                    })

                    return {
                        ...fullCard,
                        listId: card.listId,
                        listName: card.list?.name ?? 'Unknown',
                        labels: fullCard?.labels.map((l) => l.label),
                        assignees: fullCard?.assignees.map((l) => ({
                            id: l.user.id,
                            name: l.user.name,
                            email: l.user.email,
                            avatarUrl: l.user.avatarUrl
                        })),
                        comments: fullCard?.comments.map((c) => ({
                            id: c.id,
                            content: c.content,
                            createdAt: c.createdAt,
                            user: c.user
                        })),
                        activities: fullCard?.activities.map((a) => ({
                            id: a.id,
                            action: a.action,
                            detail: a.detail,
                            createdAt: a.createdAt,
                            user: a.user
                        })),
                        customFields: fullCard?.customFieldValues.map((cf) => ({
                            id: cf.boardCustomField.id,
                            name: cf.boardCustomField.name,
                            value: cf.value
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
                startDate: t.Optional(t.Nullable(t.String({
                    format: 'date-time'
                }))),
                dueDate: t.Optional(t.Nullable(t.String({
                    format: 'date-time'
                }))),
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
