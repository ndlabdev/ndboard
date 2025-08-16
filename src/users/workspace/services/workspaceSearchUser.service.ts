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

// ** Types Imports
import { paginationType } from '@src/types/core.type'

export const workspaceInviteMemberSearch = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:workspaceId/search-user',
        async({ status, params, query, user }) => {
            const { workspaceId } = params
            const { q = '', page = 1, pageSize = 20 } = query

            // Check workspace existence
            const workspace = await prisma.workspace.findUnique({
                where: {
                    id: workspaceId
                }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }

            // Get all member IDs to exclude
            const members = await prisma.workspaceMember.findMany({
                where: {
                    workspaceId
                },
                select: {
                    userId: true
                }
            })
            const excludeIds = members.map((m) => m.userId)

            // Pagination calculation
            const skip = (Number(page) - 1) * Number(pageSize)
            const take = Number(pageSize)

            // Search user by name, email, username
            const [total, users] = await Promise.all([
                prisma.user.count({
                    where: {
                        id: {
                            notIn: [...excludeIds, user.id]
                        },
                        isActive: true,
                        isBanned: false,
                        OR: [
                            {
                                name: {
                                    contains: q, mode: 'insensitive'
                                }
                            },
                            {
                                email: {
                                    contains: q, mode: 'insensitive'
                                }
                            },
                            {
                                username: {
                                    contains: q, mode: 'insensitive'
                                }
                            }
                        ]
                    }
                }),
                prisma.user.findMany({
                    where: {
                        id: {
                            notIn: [...excludeIds, user.id]
                        },
                        isActive: true,
                        isBanned: false,
                        OR: [
                            {
                                name: {
                                    contains: q, mode: 'insensitive'
                                }
                            },
                            {
                                email: {
                                    contains: q, mode: 'insensitive'
                                }
                            },
                            {
                                username: {
                                    contains: q, mode: 'insensitive'
                                }
                            }
                        ]
                    },
                    skip,
                    take,
                    orderBy: {
                        name: 'asc'
                    },
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        email: true,
                        avatarUrl: true,
                        isVerified: true
                    }
                })
            ])

            return status('OK', {
                data: users,
                meta: {
                    total,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    totalPages: Math.ceil(total / Number(pageSize))
                }
            })
        },
        {
            query: t.Object({
                ...paginationType,
                q: t.String()
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Search all users to invite',
                description:
                    'Search users by name, email, username; exclude current members, self, banned or inactive users'
            }
        }
    )
