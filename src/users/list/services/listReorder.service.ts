// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const listReorder = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/reorder',
        async({ status, body, user }) => {
            const { boardId, lists } = body
            const userId = user.id

            // Check if board exists & workspace permission
            const board = await prisma.board.findUnique({
                where: {
                    id: boardId
                },
                include: {
                    workspace: {
                        include: {
                            members: true
                        }
                    },
                    lists: true
                }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            const isMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            // Validate all list ids belong to this board
            const boardListIds = board.lists.map((l) => l.id)
            const allValid = lists.every((l) => boardListIds.includes(l.id))
            if (!allValid) {
                return status('Bad Request', {
                    code: ERROR_CODES.LIST.INVALID,
                    message: 'One or more lists do not belong to this board'
                })
            }

            // Validate unique order & unique list ids
            const orderSet = new Set(lists.map((l) => l.order))
            const idSet = new Set(lists.map((l) => l.id))
            if (orderSet.size !== lists.length || idSet.size !== lists.length) {
                return status('Bad Request', {
                    code: ERROR_CODES.LIST.INVALID_ORDER,
                    message: 'Orders or list ids are not unique'
                })
            }

            try {
                // Batch update list orders in a transaction
                await prisma.$transaction(
                    lists.map((l) =>
                        prisma.list.update({
                            where: {
                                id: l.id
                            },
                            data: {
                                order: l.order,
                                updatedById: userId
                            }
                        }))
                )

                // Log activity
                await prisma.boardActivity.create({
                    data: {
                        boardId: boardId,
                        userId,
                        action: 'reorder_list',
                        detail: `Reordered lists in board "${board.name}"`
                    }
                })

                return status('OK', {
                    data: true,
                    message: 'List reorder successfully!'
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                boardId: t.String(),
                lists: t.Array(
                    t.Object({
                        id: t.String(),
                        order: t.Integer()
                    }),
                    {
                        minItems: 2
                    }
                )
            }),
            detail: {
                tags: ['List'],
                summary: 'Reorder lists in a board',
                description: 'Batch reorder lists by changing their order field. User must be a member of the board’s workspace. All list ids must belong to the board and orders must be unique.'
            }
        }
    )
