// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { boardModels } from '../board.model';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardGetAllList = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .get(
        '/:boardId/lists',
        async ({ params, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId } = params

            // Check if board exists
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

            if (!member) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not allowed to access this board'
                })
            }

            try {
                // Get all lists in the board, ordered by position
                const lists = await prisma.list.findMany({
                    where: { boardId },
                    orderBy: { position: 'asc' },
                    include: {
                        cards: {
                            orderBy: { position: 'asc' }
                        }
                    }
                })

                return status('OK', {
                    data: lists,
                    meta: {
                        total: lists.length
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: 'boardSearch'
        }
    )
