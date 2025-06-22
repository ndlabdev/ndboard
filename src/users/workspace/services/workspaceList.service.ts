// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Models Imports
import { workspaceModels } from '../workspace.model';

// ** Prisma Imports
import prisma from '@db';
import { Prisma } from '@prisma/client';

// ** Constants Imports
import { PAGE } from '@constants';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const workspaceList = new Elysia()
    .use(authUserPlugin)
    .use(workspaceModels)
    .get(
        '/',
        async ({ status, query, user }) => {
            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.WorkspaceMemberWhereInput = {
                userId: user.id
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.workspaceMember.findMany({
                        take,
                        skip,
                        include: {
                            workspace: true
                        },
                        orderBy: {
                            joinedAt: 'desc'
                        }
                    }),
                    prisma.workspaceMember.count({
                        where: search
                    })
                ])

                return status('OK', {
                    data: data.map(member => ({
                        id: member.workspace.id,
                        name: member.workspace.name,
                        description: member.workspace.description,
                        role: member.role,
                        joinedAt: member.joinedAt,
                        ownerId: member.workspace.ownerId,
                        createdAt: member.workspace.createdAt,
                        updatedAt: member.workspace.updatedAt
                    })),
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
            query: 'workspaceSearch',
            detail: {
                tags: ['Workspace'],
                summary: 'Get list of workspaces the user is a member of',
                description: 'Return paginated list of workspaces, each with member role and join info'
            }
        },
    )
