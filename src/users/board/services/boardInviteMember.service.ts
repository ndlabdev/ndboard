// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { MemberRole } from '@prisma/client';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { boardModels } from '../board.model';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardInviteMember = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .post(
        '/:id/invite',
        async ({ params, body, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const myMember = await prisma.boardMember.findFirst({
                where: {
                    boardId: params.id,
                    userId: user.id
                }
            })

            function isAdminOrOwner(role: MemberRole | undefined): boolean {
                return role === MemberRole.ADMIN || role === MemberRole.OWNER;
            }

            if (!myMember || !isAdminOrOwner(myMember.role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not allowed to invite members'
                });
            }

            const invitedUser = await prisma.user.findUnique({
                where: {
                    id: body.userId
                }
            })

            if (!invitedUser) {
                return status('Not Found', {
                    code: ERROR_CODES.NOT_FOUND,
                    message: 'User to invite not found'
                });
            }

            const alreadyMember = await prisma.boardMember.findFirst({
                where: {
                    boardId: params.id,
                    userId: body.userId
                }
            })

            if (alreadyMember) {
                return status('Conflict', {
                    code: ERROR_CODES.ALREADY_MEMBER,
                    message: 'User is already a member of this board'
                });
            }

            const member = await prisma.boardMember.create({
                data: {
                    boardId: params.id,
                    userId: body.userId,
                    role: body.role
                }
            })

            return {
                data: {
                    memberId: member.id,
                    userId: member.userId,
                    boardId: member.boardId,
                    role: member.role,
                    status: 'JOINED'
                }
            }
        },
        {
            body: 'boardInviteMember'
        }
    )
