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

export const listCreate = new Elysia()
    .use(authUserPlugin)
    .use(listModels)
    .post(
        '/',
        async ({ body, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId, name, position } = body

            const board = await prisma.board.findUnique({
                where: { id: boardId },
                include: { members: true }
            })

            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD_NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Verify if user is a valid board member
            const member = board.members.find((m) => m.userId === user.id)

            function isGuestOrObserver(role: MemberRole | undefined): boolean {
                return role === MemberRole.GUEST || role === MemberRole.OBSERVER;
            }

            if (!member || isGuestOrObserver(member.role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not allowed to create list in this board'
                })
            }

            try {
                // Determine list position if not provided
                let finalPosition = position
                if (finalPosition === undefined) {
                    const maxPosition = await prisma.list.aggregate({
                        where: { boardId },
                        _max: { position: true }
                    })

                    finalPosition = (maxPosition._max.position ?? 0) + 1
                }

                // Create new list
                const newList = await prisma.list.create({
                    data: {
                        boardId,
                        name,
                        position: finalPosition
                    }
                })

                return status('Created', { newList })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'listCreate'
        }
    )
