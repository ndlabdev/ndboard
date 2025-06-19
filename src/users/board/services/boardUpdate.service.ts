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

export const boardUpdate = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .patch(
        '/:boardId',
        async ({ body, params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const board = await prisma.board.findUnique({
                where: { id: params.boardId },
                include: {
                    members: {
                        where: {
                            userId: user.id
                        },
                        select: {
                            role: true
                        }
                    }
                }
            })

            if (!board || board.deletedAt) {
                return status('Not Found', {
                    code: ERROR_CODES.NOT_FOUND,
                    message: 'Board not found'
                })
            }

            function isAdminOrOwner(role: MemberRole | undefined): boolean {
                return role === MemberRole.ADMIN || role === MemberRole.OWNER;
            }

            const role = board.members[0]?.role;
            if (!isAdminOrOwner(role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Not allowed to update board'
                });
            }

            const updatedBoard = await prisma.board.update({
                where: { id: params.boardId },
                data: {
                    ...(body.name ? { name: body.name } : {}),
                    ...(body.description ? { description: body.description } : {}),
                    ...(body.visibility ? { visibility: body.visibility } : {})
                }
            })

            return status('OK', {
                data: updatedBoard
            })
        },
        {
            body: 'boardUpdate'
        }
    )
