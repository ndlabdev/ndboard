// ** Elysia Imports
import { Elysia, t } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { MemberRole } from '@prisma/client';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardKichMember = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:boardId/member/:userId',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId, userId: targetUserId } = params

            // Get the acting member (the one performing the action)
            const actor = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: user.id
                }
            })

            if (!actor) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not a member of this board'
                })
            }

            // Get the target member (the one to be removed)
            const target = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: targetUserId
                }
            })

            if (!target) {
                return status('Not Found', {
                    code: ERROR_CODES.USER_NOT_FOUND,
                    message: 'Member not found in this board'
                })
            }

            // Prevent removing the owner
            if (target.role === MemberRole.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.CANNOT_REMOVE_OWNER,
                    message: 'Cannot remove owner from board'
                })
            }

            // Prevent self-removal with this API (use leave board instead)
            if (user.id === targetUserId) {
                return status('Bad Request', {
                    code: ERROR_CODES.CANNOT_SELF_REMOVE,
                    message: 'Use leave board to remove yourself'
                })
            }

            // Rule: ADMIN can only remove MEMBER/GUEST/OBSERVER, OWNER can remove all except OWNER
            if (actor.role === MemberRole.ADMIN) {
                function isNoAdminOrOwner(role: MemberRole | undefined): boolean {
                    return role === MemberRole.MEMBER || role === MemberRole.GUEST || role === MemberRole.OBSERVER;
                }

                if (!isNoAdminOrOwner(target.role)) {
                    return status('Forbidden', {
                        code: ERROR_CODES.FORBIDDEN,
                        message: 'You are not allowed to remove this member'
                    })
                }
            }

            return await prisma.boardMember.delete({
                where: {
                    id: target.id
                }
            })
        },
        {
            params: t.Object({
                boardId: t.String(),
                userId: t.String()
            })
        }
    )
