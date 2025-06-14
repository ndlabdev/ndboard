// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { Prisma } from '@prisma/client';

// ** Constants Imports
import { PAGE } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { boardModels } from '../board.model';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardGetAll = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .get(
        '/',
        async ({ query, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.BoardWhereInput = {
                deletedAt: null,
                members: {
                    some: {
                        userId: user.id,
                        ...(query.role ? { role: query.role } : {})
                    }
                },
                name: {
                    contains: query.name || undefined,
                    mode: 'insensitive'
                },
                ...(query.visibility ? { visibility: query.visibility } : {}),
                ...(query.archived
                    ? { archivedAt: { not: null } }
                    : { archivedAt: null })
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.board.findMany({
                        take,
                        skip,
                        orderBy: {
                            updatedAt: 'desc'
                        },
                        where: search,
                        include: {
                            members: {
                                where: {
                                    userId: user.id
                                },
                                select: {
                                    role: true
                                }
                            },
                            _count: {
                                select: {
                                    lists: true,
                                    card: true
                                }
                            },
                            owner: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatar: true
                                }
                            },
                        }
                    }),
                    prisma.board.count({
                        where: search
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
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: 'boardSearch'
        }
    )
