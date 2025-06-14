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

export const listUpdate = new Elysia()
    .use(authUserPlugin)
    .use(listModels)
    .patch(
        '/:id',
        async ({ params, body, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { id } = params
            const { name, position } = body

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

            try {
                // Prepare update data
                const updateData: Partial<Pick<typeof list, 'name' | 'position'>> = {}
                if (name !== undefined) updateData.name = name
                if (position !== undefined) updateData.position = position

                if (Object.keys(updateData).length === 0) {
                    return status('OK', {
                        data: {
                            id: list.id,
                            name: list.name,
                            position: list.position
                        }
                    })
                }

                return await prisma.list.update({
                    where: { id },
                    data: updateData
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'listUpdate'
        }
    )
