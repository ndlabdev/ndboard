// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { PAGE } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

export const cardGetComments = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:cardId/comments',
        async({ params, query, status, user }) => {
            const { cardId } = params
            const userId = user.id
            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            // Check card
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

            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.cardComment.findMany({
                        where: {
                            cardId
                        },
                        include: {
                            user: {
                                select: {
                                    id: true, name: true, email: true, avatarUrl: true
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        },
                        skip: (page - 1) * pageSize,
                        take: pageSize
                    }),
                    prisma.cardComment.count({
                        where: {
                            cardId
                        }
                    })
                ])

                return status('OK', {
                    data,
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
                ...paginationType
            }),
            detail: {
                tags: ['Card'],
                summary: 'Get card comments',
                description: 'Get comments of a card, newest first, with pagination.'
            }
        }
    )
