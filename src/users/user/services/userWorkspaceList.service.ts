// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const userWorkspaceList = new Elysia()
    .use(authUserPlugin)
    .get(
        '/workspaces',
        async({ status, user }) => {
            try {
                const workspaces = await prisma.workspace.findMany({
                    where: {
                        members: {
                            some: {
                                userId: user.id
                            }
                        }
                    },
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        avatarUrl: true
                                    }
                                }
                            }
                        },
                        boards: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                visibility: true,
                                createdAt: true,
                                updatedAt: true
                            },
                            orderBy: {
                                updatedAt: 'desc'
                            }
                        }
                    }
                })

                return status('OK', {
                    data: workspaces.map((ws) => ({
                        id: ws.id,
                        name: ws.name,
                        slug: ws.slug,
                        description: ws.description,
                        imageUrl: ws.imageUrl,
                        ownerId: ws.ownerId,
                        createdAt: ws.createdAt,
                        updatedAt: ws.updatedAt,
                        memberCount: ws.members.length,
                        members: ws.members.map((m) => ({
                            id: m.user.id,
                            name: m.user.name,
                            email: m.user.email,
                            avatarUrl: m.user.avatarUrl,
                            role: m.role
                        })),
                        boards: ws.boards
                    }))
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['User', 'Workspace'],
                summary: 'Get all workspaces of current user',
                description:
                    'Return list of workspaces that current user is a member, including boards and members'
            }
        }
    )
