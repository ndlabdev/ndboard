// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Models Imports
import { workspaceModels } from '../workspace.model';

// ** Prisma Imports
import prisma from '@db';
import { Prisma } from '@prisma/client';

// ** Constants Imports
import { PAGE, WORKSPACE_ROLES } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const workspaceMemberList = new Elysia()
    .use(authUserPlugin)
    .use(workspaceModels)
    .get(
        '/:workspaceId/members',
        async ({ status, query, params, user }) => {
            const workspaceId = params.workspaceId
            const userId = user.id

            // Check if user is member of this workspace
            const isMember = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId
                    }
                }
            })
            if (!isMember) {
                return status('OK', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.WorkspaceMemberWhereInput = {
                workspaceId,
                role: query.role && Object.values(WORKSPACE_ROLES).includes(query.role) ? query.role : undefined,
                user: query.search
                    ? {
                        OR: [
                            { name: { contains: query.search, mode: 'insensitive' } },
                            { email: { contains: query.search, mode: 'insensitive' } }
                        ]
                    }
                    : undefined
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.workspaceMember.findMany({
                        take,
                        skip,
                        include: {
                            user: true,
                            invitedBy: true
                        },
                        orderBy: {
                            joinedAt: 'asc'
                        }
                    }),
                    prisma.workspaceMember.count({
                        where: search
                    })
                ])

                return status('OK', {
                    data: data.map(member => ({
                        id: member.user.id,
                        name: member.user.name,
                        email: member.user.email,
                        avatarUrl: member.user.avatarUrl,
                        role: member.role,
                        joinedAt: member.joinedAt,
                        invitedBy: member.invitedBy
                            ? {
                                id: member.invitedBy.id,
                                name: member.invitedBy.name,
                                email: member.invitedBy.email
                            }
                            : null
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
            query: 'workspaceMemberSearch',
            detail: {
                tags: ['Workspace'],
                summary: 'Get workspace members',
                description: 'Get all members of a workspace, with search and filter'
            }
        },
    )
