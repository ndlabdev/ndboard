// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceRemoveMember = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:workspaceId/members/:userId',
        async ({ status, params, user }) => {
            const { workspaceId, userId: targetUserId } = params
            const operatorId = user.id

            // Check workspace existence
            const workspace = await prisma.workspace.findUnique({
                where: { id: workspaceId }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }

            // Check operator's role (must be owner or admin)
            const operatorMember = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: operatorId
                    }
                }
            })
            if (!operatorMember || (operatorMember.role !== WORKSPACE_ROLES.OWNER && operatorMember.role !== WORKSPACE_ROLES.ADMIN)) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'Only owner or admin can remove members'
                })
            }

            // Check target member
            const targetMember = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: targetUserId
                    }
                }
            })
            if (!targetMember) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'User is not a member of this workspace'
                })
            }

            // Prevent removing owner
            if (targetMember.role === WORKSPACE_ROLES.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.REMOVE_OWNER_DENIED,
                    message: 'Cannot remove the owner of the workspace'
                })
            }

            try {
                const deleted = await prisma.workspaceMember.delete({
                    where: {
                        workspaceId_userId: {
                            workspaceId,
                            userId: targetUserId
                        }
                    }
                })

                return status('OK', {
                    data: deleted
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Workspace'],
                summary: 'Remove member from workspace',
                description: 'Owner or admin can remove member from workspace'
            }
        }
    )
