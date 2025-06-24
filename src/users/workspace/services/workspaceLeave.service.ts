// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceLeave = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:workspaceId/leave',
        async({ status, params, user }) => {
            const { workspaceId } = params
            const userId = user.id

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

            // Check member
            const member = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId
                    }
                }
            })
            if (!member) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'You are not a member of this workspace'
                })
            }

            // Owner cannot leave
            if (member.role === WORKSPACE_ROLES.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.LEAVE_OWNER_DENIED,
                    message: 'Owner cannot leave workspace. Please transfer ownership before leaving.'
                })
            }

            try {
                // Remove member
                const removeMember = await prisma.workspaceMember.delete({
                    where: {
                        workspaceId_userId: {
                            workspaceId, userId
                        }
                    }
                })

                // Audit log
                await prisma.auditLog.create({
                    data: {
                        userId,
                        action: 'WORKSPACE_MEMBER_LEFT',
                        description: `User ${userId} left workspace ${workspaceId}.`
                    }
                })

                return status('OK', {
                    data: removeMember
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Workspace'],
                summary: 'Leave workspace',
                description: 'Member/admin can leave workspace (owner must transfer ownership first)'
            }
        }
    )
