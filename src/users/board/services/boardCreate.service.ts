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

export const boardCreate = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .post(
        '/',
        async ({ body, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const exist = await prisma.board.findFirst({
                where: {
                    name: body.name,
                    ownerId: user.id,
                    archivedAt: null
                }
            })

            if (exist) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD_NAME_DUPLICATED,
                    message: 'Board name already exists for this user'
                })
            }

            try {
                const board = await prisma.board.create({
                    data: {
                        ...body,
                        ownerId: user.id,
                        members: {
                            create: [{
                                userId: user.id,
                                role: MemberRole.OWNER,
                            }]
                        }
                    },
                    include: { members: true }
                })

                return status('Created', { board })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'boardCreate'
        }
    )
