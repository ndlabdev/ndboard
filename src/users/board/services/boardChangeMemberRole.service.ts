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

export const boardChangeMemberRole = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .patch(
        '/board/:boardId/member/:userId/role',
        async ({ params, body, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId, userId: targetUserId } = params

            // Get the acting member (the one performing the action)
            const actor = await prisma.boardMember.findFirst({
                where: { boardId, userId: user.id }
            })

            if (!actor) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not a member of this board'
                })
            }

            // Get the target member
            const target = await prisma.boardMember.findFirst({
                where: { boardId, userId: targetUserId }
            })

            if (!target) {
                return status('Not Found', {
                    code: ERROR_CODES.USER_NOT_FOUND,
                    message: 'Member not found in this board'
                })
            }

            // Prevent changing the owner role
            if (target.role === MemberRole.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.CANNOT_REMOVE_OWNER,
                    message: 'Cannot change the owner role'
                })
            }

            // Prevent self role change
            if (user.id === targetUserId) {
                return status('Bad Request', {
                    code: ERROR_CODES.CANNOT_SELF_REMOVE,
                    message: 'Use another action to change your own role'
                })
            }

            // ADMIN cannot change role of ADMIN or higher
            if (actor.role === MemberRole.ADMIN) {
                function isAdminOrOwner(role: MemberRole | undefined): boolean {
                    return role === MemberRole.ADMIN || role === MemberRole.OWNER;
                }


                if (isAdminOrOwner(target.role)) {
                    return status('Forbidden', {
                        code: ERROR_CODES.FORBIDDEN,
                        message: 'You are not allowed to change this member role'
                    });
                }
            }

            // OWNER can change any role (except OWNER)
            const oldRole = target.role
            const newRole = body.role

            if (oldRole === newRole) {
                return status('OK', {
                    data: {
                        userId: targetUserId,
                        oldRole,
                        newRole
                    }
                })
            }

            await prisma.boardMember.update({
                where: { id: target.id },
                data: { role: newRole }
            })

            return status('OK', {
                data: {
                    userId: targetUserId,
                    oldRole,
                    newRole
                }
            })
        },
        {
            body: 'boardChangeMemberRole'
        }
    )
