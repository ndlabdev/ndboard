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

export const listMove = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:listId/move',
        async({ params, body, status, user }) => {
            const { listId } = params
            const { boardId } = body
            const userId = user.id

            // Find the list, including its board and workspace
            const list = await prisma.list.findUnique({
                where: {
                    id: listId
                },
                include: {
                    board: {
                        include: {
                            workspace: {
                                include: {
                                    members: true
                                }
                            }
                        }
                    },
                    cards: true
                }
            })
            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Check if target board exists and get its workspace
            const targetBoard = await prisma.board.findUnique({
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
            if (!targetBoard) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Target board does not exist'
                })
            }

            // Check permission on both workspaces
            const isMemberSource = list.board.workspace.members.some((m) => m.userId === userId)
            const isMemberTarget = targetBoard.workspace.members.some((m) => m.userId === userId)
            if (!isMemberSource || !isMemberTarget) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of both source and target workspace',
                    status: 403
                })
            }

            // If moving to the same board, do nothing or return conflict
            if (list.boardId === boardId) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.ALREADY_IN_BOARD,
                    message: 'List is already in the target board'
                })
            }

            // Get next order for the new list in target board
            const maxOrder = await prisma.list.aggregate({
                where: {
                    boardId
                },
                _max: {
                    order: true
                }
            })
            const nextOrder = (maxOrder._max.order ?? 0) + 1

            try {
                const [updatedList] = await prisma.$transaction([
                    // Update list to target board and new order
                    prisma.list.update({
                        where: {
                            id: listId
                        },
                        data: {
                            boardId: boardId,
                            order: nextOrder,
                            updatedById: userId
                        }
                    }),
                    // Update all cards to new boardId
                    prisma.card.updateMany({
                        where: {
                            listId
                        },
                        data: {
                            boardId
                        }
                    }),
                    // Log activity on target board
                    prisma.boardActivity.create({
                        data: {
                            boardId: boardId,
                            userId,
                            action: 'move_list',
                            detail: `Moved list "${list.name}" to this board`
                        }
                    })
                ])

                return status('OK', {
                    data: {
                        id: updatedList.id,
                        name: updatedList.name,
                        boardId: updatedList.boardId,
                        isFold: updatedList.isFold,
                        order: updatedList.order,
                        createdAt: updatedList.createdAt,
                        updatedAt: updatedList.updatedAt
                    },
                    status: 200
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                boardId: t.String()
            }),
            detail: {
                tags: ['List'],
                summary: 'Move a list to another board',
                description: 'Move a list and all its cards to another board. User must be a member of both the source and target workspace. List will be placed at the end of the target board.'
            }
        }
    )
