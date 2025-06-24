// ** Elysia Imports
import { Elysia, t } from 'elysia'

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
        '/:boardId/invite-member',
        async ({ status, body, params, user, server, request, headers }) => {
            const { boardId } = params
            const { userId: inviteUserId, role } = body
            const currentUserId = user.id

            // Find the board by ID
            const board = await prisma.board.findUnique({
                where: { id: boardId },
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

            // Check permission: only owner
            if (board.ownerId !== currentUserId) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to invite members to this board'
                })
            }

            // Check if invite user is a member of workspace
            const isWorkspaceMember = board.workspace.members.some(member => member.userId === inviteUserId)
            if (!isWorkspaceMember) {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'User is not a member of the workspace'
                })
            }

            // Check if user is already a board member
            const isAlreadyBoardMember = await prisma.boardMember.findUnique({
                where: {
                    boardId_userId: {
                        boardId,
                        userId: inviteUserId
                    }
                }
            })
            if (isAlreadyBoardMember) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD.USER_ALREADY_MEMBER,
                    message: 'This user is already a member of the board'
                })
            }

            try {
                // Create new board member
                await prisma.boardMember.create({
                    data: {
                        boardId,
                        userId: inviteUserId,
                        role,
                        invitedById: currentUserId
                    }
                })

                // Lookup names for current user and invited user
                const [inviter, invited] = await Promise.all([
                    prisma.user.findUnique({ where: { id: currentUserId }, select: { name: true } }),
                    prisma.user.findUnique({ where: { id: inviteUserId }, select: { name: true } })
                ])

                const detail = inviter && invited
                    ? `${inviter.name} invited ${invited.name} as ${role}`
                    : `Invited user "${inviteUserId}" as ${role}`

                // Log activity and audit
                await prisma.$transaction([
                    prisma.auditLog.create({
                        data: {
                            userId: currentUserId,
                            action: 'BOARD_INVITE_MEMBER',
                            description: detail,
                            ipAddress: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }),
                    prisma.boardActivity.create({
                        data: {
                            boardId,
                            userId: currentUserId,
                            action: 'invite_member',
                            detail
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        boardId,
                        userId: inviteUserId,
                        role
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                userId: t.String(),
                role: t.Enum(BOARD_ROLE)
            }),
            detail: {
                tags: ['Board'],
                summary: 'Invite member to board',
                description: 'Invite a workspace member to join the board. Only the board owner can invite. Activity and audit logs are created for each invite.'
            }
        }
    )
