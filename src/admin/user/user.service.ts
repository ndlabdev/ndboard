// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { Prisma } from '@prisma/client'

// ** Constants Imports
import { PAGE } from '@constants'

// ** Models Imports
import { userModels } from './user.model'

export const userTableList = new Elysia()
    .use(userModels)
    .get(
        '/',
        async ({ query, status }) => {
            try {
                const page = Number(query.page) || PAGE.CURRENT
                const pageSize = Number(query.pageSize) || PAGE.SIZE

                const skip = ((page - 1) * pageSize) || undefined
                const take = pageSize || undefined

                const search: Prisma.UserWhereInput = {
                    name: {
                        contains: query.name || undefined,
                        mode: 'insensitive'
                    },
                    email: {
                        contains: query.email || undefined,
                        mode: 'insensitive'
                    },
                    role: {
                        equals: query.role || undefined
                    },
                    isActive: {
                        equals: query.isActive
                    },
                    isBanned: {
                        equals: query.isBanned
                    }
                }

                const [data, total] = await Promise.all([
                    prisma.user.findMany({
                        take,
                        skip,
                        orderBy: {
                            createdAt: 'desc'
                        },
                        where: search,
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            avatar: true,
                            role: true,
                            isActive: true,
                            isBanned: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    }),
                    prisma.user.count({
                        where: search
                    })
                ])

                return {
                    data,
                    meta: {
                        total,
                        page,
                        pageSize,
                        totalPages: Math.ceil(total / pageSize)
                    }
                }
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: 'userSearch'
        }
    )

export const userRetrieve = new Elysia()
    .get(
        '/:id',
        async ({ params, status }) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: params.id },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        role: true,
                        isActive: true,
                        isBanned: true,
                        bannedAt: true,
                        createdAt: true,
                        updatedAt: true
                    }
                })

                if (!user) {
                    return status('Not Found', 'User not found')
                }

                return {
                    data: user
                }
            } catch (error) {
                return status('Internal Server Error', error)
            }
        }
    )

export const userUpdate = new Elysia()
    .use(userModels)
    .patch(
        '/:id',
        async ({ params, body, status }) => {
            try {
                return await prisma.user.update({
                    where: { id: params.id },
                    data: body,
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        role: true,
                        isActive: true,
                        isBanned: true,
                        bannedAt: true,
                        createdAt: true,
                        updatedAt: true
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'userUpdate'
        }
    )

export const userBan = new Elysia()
    .use(userModels)
    .patch(
        '/:id/ban',
        async ({ params, body, status }) => {
            const { isBanned, banReason } = body

            try {
                return await prisma.user.update({
                    where: { id: params.id },
                    data: {
                        isBanned,
                        banReason: isBanned ? banReason : null,
                        bannedAt: isBanned ? new Date() : null
                    },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        role: true,
                        isActive: true,
                        isBanned: true,
                        bannedAt: true,
                        createdAt: true,
                        updatedAt: true
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'userBan'
        }
    )