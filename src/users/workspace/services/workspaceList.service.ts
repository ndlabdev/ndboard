// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { Prisma } from '@prisma/client'

// ** Constants Imports
import {
    PAGE, WORKSPACE_ROLES
} from '@constants'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

export const workspaceList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/',
        async({ status, query, user }) => {
            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.WorkspaceMemberWhereInput = {
                userId: user.id,
                role: query.role && Object.values(WORKSPACE_ROLES).includes(query.role) ? query.role : undefined,
                workspace: {
                    name: query.name
                        ? {
                            contains: query.name, mode: 'insensitive'
                        }
                        : undefined
                }
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.workspaceMember.findMany({
                        take,
                        skip,
                        where: search,
                        include: {
                            workspace: {
                                include: {
                                    _count: {
                                        select: {
                                            members: true
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: {
                            [query.sortBy || 'joinedAt']: query.order || 'desc'
                        }
                    }),
                    prisma.workspaceMember.count({
                        where: search
                    })
                ])

                return status('OK', {
                    data: data.map((member) => {
                        const { workspace } = member

                        return {
                            id: workspace.id,
                            name: workspace.name,
                            slug: workspace.slug,
                            imageUrl: workspace.imageUrl,
                            description: workspace.description,
                            role: member.role,
                            joinedAt: member.joinedAt,
                            ownerId: workspace.ownerId,
                            createdAt: workspace.createdAt,
                            updatedAt: workspace.updatedAt,
                            memberCount: workspace._count?.members ?? 0
                        }
                    }),
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
                name: t.Optional(t.String({
                    maxLength: 100
                })),
                role: t.Optional(t.Enum(WORKSPACE_ROLES)),
                sortBy: t.Optional(t.Union([
                    t.Literal('joinedAt'), t.Literal('name'), t.Literal('createdAt')
                ], {
                    default: 'joinedAt'
                })),
                order: t.Optional(t.Union([
                    t.Literal('asc'), t.Literal('desc')
                ], {
                    default: 'desc'
                }))
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Get paginated workspace list with filter, search, sort',
                description: 'Return all workspaces the user belongs to, with filter, search, and sort support'
            }
        }
    )
