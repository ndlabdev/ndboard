// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { User } from '@prisma/client'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceInviteMember = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:workspaceId/invite',
        async({ status, body, params, user }) => {
            const workspaceId = params.workspaceId
            const inviterId = user.id
            const { role = WORKSPACE_ROLES.MEMBER, email, userId, userIds } = body

            // Validate role
            if (role && !Object.values(WORKSPACE_ROLES).includes(role)) {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.ROLE_INVALID,
                    message: 'Role is invalid'
                })
            }

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

            // Only owner or admin can invite
            const inviterMember = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId, userId: inviterId
                    }
                }
            })
            if (
                !inviterMember ||
        (inviterMember.role !== WORKSPACE_ROLES.OWNER &&
          inviterMember.role !== WORKSPACE_ROLES.ADMIN)
            ) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'Only owner or admin can invite members'
                })
            }

            let invitedUsers: User[] = []

            // Invite by array of userIds
            if (Array.isArray(userIds) && userIds.length > 0) {
                invitedUsers = await prisma.user.findMany({
                    where: {
                        id: {
                            in: userIds
                        }
                    }
                })
            } else if (userId) {
                const u = await prisma.user.findUnique({
                    where: {
                        id: userId
                    }
                })
                if (u) invitedUsers = [u]
            } else if (email) {
                const u = await prisma.user.findUnique({
                    where: {
                        email
                    }
                })
                if (u) invitedUsers = [u]
            } else {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'User identifier required'
                })
            }

            if (!invitedUsers || !invitedUsers.length) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'Invited user(s) do not exist'
                })
            }

            // Filter out users already in workspace
            const existingMembers = await prisma.workspaceMember.findMany({
                where: {
                    workspaceId,
                    userId: {
                        in: invitedUsers.map((u) => u.id)
                    }
                },
                select: {
                    userId: true
                }
            })
            const existingIds = existingMembers.map((m) => m.userId)

            const toInvite = invitedUsers.filter(
                (u) => !existingIds.includes(u.id)
            )
            if (!toInvite.length) {
                return status('Conflict', {
                    code: ERROR_CODES.WORKSPACE.MEMBER_EXISTS,
                    message: 'All selected users are already members'
                })
            }

            // Add new members
            const createdMembers = await prisma.$transaction(
                toInvite.map((u) =>
                    prisma.workspaceMember.create({
                        data: {
                            workspaceId,
                            userId: u.id,
                            role,
                            invitedById: inviterId
                        },
                        include: {
                            user: true
                        }
                    }))
            )

            return status('OK', {
                data: {
                    members: createdMembers.map((m) => ({
                        id: m.user.id,
                        name: m.user.name,
                        email: m.user.email,
                        role: m.role,
                        joinedAt: m.joinedAt
                    }))
                }
            })
        },
        {
            body: t.Object({
                userIds: t.Optional(t.Array(t.String())), // ✅ support multiple users
                userId: t.Optional(t.String()),
                email: t.Optional(
                    t.String({
                        minLength: 1, format: 'email'
                    })
                ),
                role: t.Optional(t.Enum(WORKSPACE_ROLES))
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Invite workspace members',
                description: 'Invite one or many users to a workspace'
            }
        }
    )
