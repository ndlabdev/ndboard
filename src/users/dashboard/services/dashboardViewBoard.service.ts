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

export const dashboardViewBoard = new Elysia()
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
                    message: 'Cannot get dashboard for archived board'
                })
            }

            try {
                // 2. Cards by List
                const cardsByList = await prisma.card.groupBy({
                    by: ['listId'],
                    where: {
                        boardId: board.id
                    },
                    _count: {
                        id: true
                    }
                })

                const cardsByListResult = await Promise.all(
                    cardsByList.map(async(c) => {
                        const list = await prisma.list.findUnique({
                            where: {
                                id: c.listId
                            }
                        })
                        return {
                            listId: c.listId,
                            listName: list?.name ?? 'Unknown',
                            count: c._count.id
                        }
                    })
                )

                // 3. Cards by Member
                const cardsByMember = await prisma.cardAssignee.groupBy({
                    by: ['userId'],
                    _count: {
                        cardId: true
                    },
                    where: {
                        card: {
                            boardId: board.id
                        }
                    }
                })

                const cardsByMemberResult = await Promise.all(
                    cardsByMember.map(async(c) => {
                        const u = await prisma.user.findUnique({
                            where: {
                                id: c.userId
                            }
                        })
                        return {
                            userId: c.userId,
                            userName: u?.name ?? 'Unknown',
                            count: c._count.cardId
                        }
                    })
                )

                // 4. Cards by Label
                const cardsByLabel = await prisma.cardLabel.groupBy({
                    by: ['labelId'],
                    _count: {
                        cardId: true
                    },
                    where: {
                        card: {
                            boardId: board.id
                        }
                    }
                })

                const cardsByLabelResult = await Promise.all(
                    cardsByLabel.map(async(c) => {
                        const label = await prisma.boardLabel.findUnique({
                            where: {
                                id: c.labelId
                            }
                        })
                        return {
                            id: c.labelId,
                            name: label?.name ?? 'Unknown',
                            color: label?.color ?? 'gray',
                            count: c._count.cardId
                        }
                    })
                )

                // 5. Cards by Due Date (group theo ngày)
                const cardsByDueDate = await prisma.$queryRaw<
                    { date: Date; count: number }[]
                >`
                    SELECT DATE("dueDate") as date, COUNT(*)::int as count
                    FROM "Card"
                    WHERE "boardId" = ${board.id}
                    AND "dueDate" IS NOT NULL
                    GROUP BY DATE("dueDate")
                    ORDER BY DATE("dueDate")
                `

                return {
                    data: {
                        cardsByList: cardsByListResult,
                        cardsByMember: cardsByMemberResult,
                        cardsByLabel: cardsByLabelResult,
                        cardsByDueDate
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
                tags: ['Dashboard'],
                summary: 'Get board dashboard data',
                description: 'Return aggregated data (cards by list, member, label, due date) for dashboard view'
            }
        }
    )
