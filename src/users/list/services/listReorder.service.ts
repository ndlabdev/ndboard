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

export const listReorder = new Elysia()
    .use(authUserPlugin)
    .use(listModels)
    .patch(
        '/reorder',
        async ({ body, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId, orders } = body

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
                    message: 'You are not allowed to reorder lists in this board'
                })
            }

            // Validate all list ids belong to this board
            const listIds = orders.map(o => o.id)
            const lists = await prisma.list.findMany({
                where: { id: { in: listIds }, boardId }
            })

            if (lists.length !== listIds.length) {
                return status('Bad Request', {
                    code: ERROR_CODES.LIST_NOT_BELONG_TO_BOARD,
                    message: 'Some lists do not belong to this board'
                })
            }

            // Update all list positions in a transaction
            const updateOperations = orders.map(order =>
                prisma.list.update({
                    where: { id: order.id },
                    data: { position: order.position }
                })
            )

            const updatedLists = await prisma.$transaction(updateOperations)

            return status('OK', {
                data: updatedLists.map(l => ({
                    id: l.id,
                    position: l.position
                })),
                meta: { total: updatedLists.length }
            })
        },
        {
            body: 'listReorder'
        }
    )
