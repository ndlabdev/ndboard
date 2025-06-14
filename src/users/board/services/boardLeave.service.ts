// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { MemberRole } from '@prisma/client';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardLeave = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:id/leave',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const member = await prisma.boardMember.findFirst({
                where: {
                    boardId: params.id,
                    userId: user.id
                }
            })

            if (!member) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not a member of this board'
                })
            }

            if (member.role === MemberRole.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Owner cannot leave board'
                })
            }

            return await prisma.boardMember.delete({
                where: {
                    id: member.id
                },
                select: {
                    id: true
                }
            })
        }
    )
