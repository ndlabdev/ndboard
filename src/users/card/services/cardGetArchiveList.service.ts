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

export const cardGetArchiveList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/archived',
        async({ query, status, user }) => {
            const { boardId } = query
            const userId = user.id

            const page = Number(query.page) > 0 ? Number(query.page) : 1
            const pageSize = Number(query.pageSize) > 0 ? Math.min(Number(query.pageSize), 100) : 20

            // 1. Find board, include workspace.members for permission
            const board = await prisma.board.findUnique({
                where: {
                    id: boardId
                },
                include: {
                    members: true,
                    workspace: {
                        include: {
                            members: true
                        }
                    }
                }
            })

            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // 2. Check permission
            const isBoardMember = board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3. Get total archived card count for meta
            const total = await prisma.card.count({
                where: {
                    boardId,
                    isArchived: true,
                    name: {
                        contains: query.q,
                        mode: 'insensitive'
                    }
                }
            })

            // 4. Get paginated archived cards (all lists in board)
            const cards = await prisma.card.findMany({
                where: {
                    boardId,
                    isArchived: true,
                    name: {
                        contains: query.q,
                        mode: 'insensitive'
                    }
                },
                orderBy: {
                    updatedAt: 'desc'
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    list: {
                        select: {
                            id: true, name: true
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
                    customFieldValues: {
                        include: {
                            boardCustomField: true
                        }
                    }
                }
            })

            return status('OK', {
                data: cards.map((card) => ({
                    id: card.id,
                    name: card.name,
                    description: card.description,
                    list: card.list,
                    dueDate: card.dueDate,
                    order: card.order,
                    isArchived: card.isArchived,
                    updatedAt: card.updatedAt,
                    labels: card.labels.map((l) => l.label),
                    assignees: card.assignees.map((a) => ({
                        id: a.user.id,
                        name: a.user.name,
                        avatarUrl: a.user.avatarUrl
                    })),
                    attachments: card.attachments,
                    customFields: card.customFieldValues.map((cf) => ({
                        id: cf.boardCustomField.id,
                        name: cf.boardCustomField.name,
                        value: cf.value
                    }))
                })),
                meta: {
                    total,
                    page,
                    pageSize,
                    totalPages: Math.ceil(total / pageSize)
                },
                status: 200
            })
        },
        {
            query: t.Object({
                boardId: t.String(),
                q: t.String(),
                page: t.Optional(t.Integer({
                    minimum: 1
                })),
                pageSize: t.Optional(t.Integer({
                    minimum: 1, maximum: 100
                }))
            }),
            detail: {
                tags: ['Card'],
                summary: 'Get archived cards in a board (pagination)',
                description: 'Return paginated list of all archived cards in a board (across all lists). Only board/workspace members can access.'
            }
        }
    )
