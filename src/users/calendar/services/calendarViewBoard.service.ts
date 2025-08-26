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

export const calendarViewBoard = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:boardId',
        async({ params, status, user }) => {
            const userId = user.id

            // 1. Find board + check quyền
            const board = await prisma.board.findUnique({
                where: {
                    id: params.boardId
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

            const isBoardMember = board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)

            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            if (board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD.ALREADY_ARCHIVED,
                    message: 'Cannot get calendar for archived board'
                })
            }

            try {
                // 2. Lấy card có dueDate
                const cards = await prisma.card.findMany({
                    where: {
                        boardId: board.id,
                        OR: [{
                            startDate: {
                                not: null
                            }
                        },
                        {
                            dueDate: {
                                not: null
                            }
                        }]
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
                                        avatarUrl: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        dueDate: 'asc'
                    }
                })

                const result = cards.map((c) => ({
                    id: c.id,
                    name: c.name,
                    startDate: c.startDate,
                    dueDate: c.dueDate,
                    listId: c.listId,
                    listName: c.list?.name ?? 'Unknown',
                    labels: c.labels.map((l) => ({
                        id: l.label.id,
                        name: l.label.name,
                        color: l.label.color
                    })),
                    assignees: c.assignees.map((a) => ({
                        id: a.user.id,
                        name: a.user.name,
                        avatarUrl: a.user.avatarUrl
                    }))
                }))

                return {
                    data: result,
                    meta: {
                        total: result.length
                    }
                }
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            params: t.Object({
                boardId: t.String({
                    minLength: 1
                })
            }),
            detail: {
                tags: ['Calendar'],
                summary: 'Get board calendar data',
                description: 'Return all cards with dueDate in the board for calendar view'
            }
        }
    )
