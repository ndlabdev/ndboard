// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { Prisma } from '@prisma/client'

// ** Third Party Imports
import ogs from 'open-graph-scraper'
import { OgObject } from 'open-graph-scraper/types'

// ** Constants Imports
import { PAGE } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

export const cardGetByList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/l/:listId',
        async({ status, params, query, user }) => {
            const { listId } = params
            const userId = user.id

            // Find list and check permission
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

            // Check permission: must be member of board or workspace
            const isBoardMember = list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) | PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.CardWhereInput = {
                listId,
                ...(query.includeArchived ? {} : {
                    isArchived: false
                }),
                name: query.search
                    ? {
                        contains: query.search, mode: 'insensitive'
                    }
                    : undefined
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.card.findMany({
                        take,
                        skip,
                        where: search,
                        orderBy: {
                            order: 'asc'
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
                            },
                            checklists: {
                                select: {
                                    id: true
                                }
                            },
                            attachments: true,
                            customFieldValues: {
                                include: {
                                    boardCustomField: true
                                }
                            }
                        }
                    }),
                    prisma.card.count({
                        where: search
                    })
                ])

                return status('OK', {
                    data: await Promise.all(
                        data.map(async(card) => {
                            let meta: OgObject | undefined

                            if (/^https?:\/\/\S+$/i.test(card.name.trim())) {
                                try {
                                    const { error, result } = await ogs({
                                        url: card.name
                                    })
                                    if (!error) meta = result
                                } catch(e) {
                                    meta = undefined
                                }
                            }
                            return {
                                id: card.id,
                                name: card.name,
                                description: card.description,
                                dueDate: card.dueDate,
                                order: card.order,
                                isArchived: card.isArchived,
                                createdAt: card.createdAt,
                                updatedAt: card.updatedAt,
                                labels: card.labels.map((l) => l.label),
                                assignees: card.assignees.map((a) => ({
                                    id: a.user.id,
                                    name: a.user.name,
                                    avatarUrl: a.user.avatarUrl
                                })),
                                checklistCount: card.checklists.length,
                                attachments: card.attachments,
                                customFields: card.customFieldValues.map((cf) => ({
                                    id: cf.boardCustomField.id,
                                    name: cf.boardCustomField.name,
                                    value: cf.value
                                })),
                                meta
                            }
                        })
                    ),
                    meta: {
                        total,
                        page,
                        pageSize,
                        totalPages: Math.ceil(total / pageSize)
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: t.Object({
                ...paginationType,
                search: t.Optional(t.String()),
                includeArchived: t.Optional(t.Boolean())
            }),
            detail: {
                tags: ['Card'],
                summary: 'Get all cards in a list',
                description: 'Return all cards in a list, ordered by order. Supports search, filter, and pagination. Only board/workspace members can access.'
            }
        }
    )
