// ** Elysia Imports
import { Elysia, t } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const workspaceChangeMemberRole = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:workspaceId/members/:userId/role',
        async ({ status, params, body, user }) => {
            const { workspaceId, userId: targetUserId } = params
            const { role: newRole } = body
            const operatorId = user.id

            // Find the workspace and check if user is owner
            const workspace = await prisma.workspace.findUnique({
                where: { id: workspaceId }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }

            // Check operator's role (must be owner)
            const operatorMember = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: operatorId
                    }
                }
            })
            if (!operatorMember || operatorMember.role !== WORKSPACE_ROLES.OWNER) {
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
                // Update role
                const updatedMember = await prisma.workspaceMember.update({
                    where: {
                        workspaceId_userId: {
                            workspaceId,
                            userId: targetUserId
                        }
                    },
                    data: { role: newRole },
                    include: { user: true }
                })

                // Write audit log
                await prisma.auditLog.create({
                    data: {
                        userId: operatorId,
                        action: 'WORKSPACE_MEMBER_ROLE_CHANGED',
                        description: `Changed role of user ${targetUserId} to ${newRole} in workspace ${workspaceId}`
                    }
                })

                return status('OK', {
                    data: {
                        id: updatedMember.user.id,
                        name: updatedMember.user.name,
                        email: updatedMember.user.email,
                        role: updatedMember.role,
                        joinedAt: updatedMember.joinedAt
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                role: t.Optional(t.Enum(WORKSPACE_ROLES))
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Change role of workspace member',
                description: 'Only owner can change role of member (not owner)'
            }
        },
    )
