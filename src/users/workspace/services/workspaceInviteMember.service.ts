// ** Elysia Imports
import { Elysia, t } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceInviteMember = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:workspaceId/invite',
        async ({ status, body, params, user }) => {
            const workspaceId = params.workspaceId
            const inviterId = user.id
            const { role = WORKSPACE_ROLES.MEMBER, email, userId } = body

            if (role && !Object.values(WORKSPACE_ROLES).includes(role)) {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.ROLE_INVALID,
                    message: 'Role is invalid'
                })
            }

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

            // Only owner or admin can invite
            const inviterMember = await prisma.workspaceMember.findUnique({
                where: { workspaceId_userId: { workspaceId, userId: inviterId } }
            })
            if (!inviterMember || (inviterMember.role !== WORKSPACE_ROLES.OWNER && inviterMember.role !== WORKSPACE_ROLES.ADMIN)) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'Only owner or admin can invite members'
                })
            }

            let invitedUser = null

            // Invite by userId
            if (userId) {
                invitedUser = await prisma.user.findUnique({
                    where: { id: userId }
                })
                if (!invitedUser) {
                    return status('Not Found', {
                        code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                        message: 'Workspace does not exist'
                    })
                }
            } else if (email) {
                invitedUser = await prisma.user.findUnique({ where: { email } })
            } else {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'User identifier required'
                })
            }

            if (!invitedUser) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'Invited user does not exist'
                })
            }

            // If user already is member
            const existed = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: invitedUser.id
                    }
                }
            })
            if (existed) {
                return status('Conflict', {
                    code: ERROR_CODES.WORKSPACE.MEMBER_EXISTS,
                    message: 'User is already a member'
                })
            }

            // Add to workspace
            const member = await prisma.workspaceMember.create({
                data: {
                    workspaceId,
                    userId: invitedUser.id,
                    role,
                    invitedById: inviterId
                },
                include: {
                    user: true
                }
            })

            return status('OK', {
                data: {
                    member: {
                        id: member.user.id,
                        name: member.user.name,
                        email: member.user.email,
                        role: member.role,
                        joinedAt: member.joinedAt
                    }
                }
            })
        },
        {
            body: t.Object({
                email: t.String({
                    minLength: 1,
                    format: 'email'
                }),
                userId: t.Optional(t.String()),
                role: t.Optional(t.Enum(WORKSPACE_ROLES))
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Get workspace members',
                description: 'Get all members of a workspace, with search and filter'
            }
        }
    )
