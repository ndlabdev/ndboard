// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_ROLE } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardInviteMember = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:shortLink/invite-members',
        async({ status, body, params, user, server, request, headers }) => {
            const { shortLink } = params
            const { userIds, role = BOARD_ROLE.MEMBER } = body
            const currentUserId = user.id

            // Find board
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
                },
                include: {
                    workspace: {
                        include: {
                            members: true
                        }
                    }
                }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Only owner can invite
            if (board.ownerId !== currentUserId) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to invite members to this board'
                })
            }

            const boardId = board.id
            const invitedUsers: {
                id: string;
                name: string;
                email: string;
                avatarUrl: string | null;
            }[] = []
            const skippedUsers: { userId: string; reason: string }[] = []

            for (const inviteUserId of userIds) {
                // check workspace membership
                const isWorkspaceMember = board.workspace.members.some(
                    (m) => m.userId === inviteUserId
                )
                if (!isWorkspaceMember) {
                    skippedUsers.push({
                        userId: inviteUserId,
                        reason: 'Not a workspace member'
                    })
                    continue
                }

                // check if already in board
                const isAlreadyBoardMember = await prisma.boardMember.findUnique({
                    where: {
                        boardId_userId: {
                            boardId, userId: inviteUserId
                        }
                    }
                })
                if (isAlreadyBoardMember) {
                    skippedUsers.push({
                        userId: inviteUserId,
                        reason: 'Already board member'
                    })
                    continue
                }

                // add user to board
                await prisma.boardMember.create({
                    data: {
                        boardId,
                        userId: inviteUserId,
                        role,
                        invitedById: currentUserId
                    }
                })

                const invitedUser = await prisma.user.findUnique({
                    where: {
                        id: inviteUserId
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                })

                if (invitedUser) {
                    invitedUsers.push(invitedUser)
                }

                // log each invite
                await prisma.$transaction([
                    prisma.auditLog.create({
                        data: {
                            userId: currentUserId,
                            action: 'BOARD_INVITE_MEMBER',
                            description: `Invited user "${inviteUserId}" as ${role}`,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId: currentUserId,
                            action: 'invite_member',
                            detail: `Invited user "${inviteUserId}" as ${role}`
                        }
                    })
                ])
            }

            return status('OK', {
                data: {
                    boardId,
                    invitedUsers,
                    skippedUsers,
                    role
                }
            })
        },
        {
            body: t.Object({
                userIds: t.Array(t.String()),
                role: t.Optional(t.Enum(BOARD_ROLE))
            }),
            detail: {
                tags: ['Board'],
                summary: 'Invite multiple members to board',
                description:
                    'Invite multiple workspace members to join the board. Only the board owner can invite. Skips users who are already board members or not in the workspace.'
            }
        }
    )
