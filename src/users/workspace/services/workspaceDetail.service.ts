// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceDetail = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:workspaceId',
        async({ status, params, user }) => {
            const workspaceId = params.workspaceId
            const userId = user.id

            // Find the workspace membership and workspace info for the current user
            const member = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId
                    }
                },
                include: {
                    workspace: true
                }
            })

            if (!member) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace or workspace does not exist'
                })
            }

            try {
                // Count the total number of members in this workspace
                const memberCount = await prisma.workspaceMember.count({
                    where: {
                        workspaceId
                    }
                })

                // Return workspace detail with current user's role and join date
                const { workspace, role, joinedAt } = member

                return status('OK', {
                    data: {
                        id: workspace.id,
                        name: workspace.name,
                        description: workspace.description,
                        ownerId: workspace.ownerId,
                        createdAt: workspace.createdAt,
                        updatedAt: workspace.updatedAt,
                        memberCount,
                        currentRole: role,
                        joinedAt
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Workspace'],
                summary: 'Get workspace detail',
                description: 'Get detail info of a workspace, only for members'
            }
        }
    )
