// ** Elysia Imports
import { Elysia, t } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { Prisma } from '@prisma/client';

// ** Constants Imports
import { BOARD_ROLE, PAGE } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

// ** Types Imports
import { paginationType } from '@src/types/core.type';

export const boardGetBoardMember = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:boardId/members',
        async ({ query, params, status, user }) => {
            const { boardId } = params
            const userId = user.id

            // Find the board by ID
            const board = await prisma.board.findUnique({
                where: { id: boardId }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Check permission: Only board member or owner can view members
            let isBoardMember = false
            if (board.ownerId === userId) {
                isBoardMember = true
            } else {
                const member = await prisma.boardMember.findUnique({
                    where: {
                        boardId_userId: {
                            boardId,
                            userId
                        }
                    }
                })
                isBoardMember = !!member
            }
            if (!isBoardMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to view members of this board'
                })
            }

            // Query owner info
            const ownerUser = await prisma.user.findUnique({
                where: { id: board.ownerId },
                select: {
                    id: true,
                    name: true,
                    avatarUrl: true
                }
            })

            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.BoardMemberWhereInput = {
                boardId,
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.boardMember.findMany({
                        take,
                        skip,
                        where: search,
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatarUrl: true
                                }
                            }
                        },
                        orderBy: {
                            joinedAt: 'desc'
                        }
                    }),
                    prisma.boardMember.count({
                        where: search
                    })
                ])

                return status('OK', {
                    data: [
                        ownerUser && {
                            userId: ownerUser.id,
                            name: ownerUser.name,
                            avatarUrl: ownerUser.avatarUrl,
                            role: BOARD_ROLE.OWNER
                        },
                        ...data.map((m) => ({
                            userId: m.user.id,
                            name: m.user.name,
                            avatarUrl: m.user.avatarUrl,
                            role: m.role
                        }))
                    ].filter(Boolean),
                    meta: {
                        total: total + (ownerUser ? 1 : 0),
                        page,
                        pageSize,
                        totalPages: Math.ceil(total / pageSize)
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: t.Object({
                ...paginationType
            }),
            detail: {
                tags: ['Board'],
                summary: 'Get list of board members',
                description: 'Retrieve a list of all members of the board, including owner and their roles. Only board members or owner can view this list.'
            },
        }
    )
