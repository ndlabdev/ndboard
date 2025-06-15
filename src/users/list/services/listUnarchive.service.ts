// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { MemberRole } from '@prisma/client';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { listModels } from '../list.model';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const listUnarchive = new Elysia()
    .use(authUserPlugin)
    .use(listModels)
    .patch(
        '/:listId/unarchive',
        async ({ params, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { listId } = params

            // Find the list, include board and members
            const list = await prisma.list.findUnique({
                where: { id: listId },
                include: {
                    board: {
                        include: { members: true }
                    }
                }
            })

            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST_NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Verify if user is a valid board member
            const member = list.board.members.find((m) => m.userId === user.id)

            function isGuestOrObserver(role: MemberRole | undefined): boolean {
                return role === MemberRole.GUEST || role === MemberRole.OBSERVER;
            }

            if (!member || isGuestOrObserver(member.role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not allowed to update this list'
                })
            }

            // Check if list is archived
            if (list.archivedAt === null) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST_NOT_ARCHIVED,
                    message: 'This list is not archived'
                })
            }

            return await prisma.list.update({
                where: { id: listId },
                data: { archivedAt: null }
            })
        }
    )
