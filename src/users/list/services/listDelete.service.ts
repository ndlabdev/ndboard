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

export const listDelete = new Elysia()
    .use(authUserPlugin)
    .use(listModels)
    .delete(
        '/:id',
        async ({ params, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { id } = params

            const list = await prisma.list.findUnique({
                where: { id },
                include: {
                    board: {
                        include: {
                            members: true
                        }
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

            // Check if already archived
            if (list.archivedAt !== null) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST_ALREADY_ARCHIVED,
                    message: 'This list has already been archived'
                })
            }

            return await prisma.list.update({
                where: { id },
                data: {
                    archivedAt: new Date()
                }
            })
        }
    )
