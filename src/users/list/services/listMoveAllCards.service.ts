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

export const listMoveAllCards = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:listId/move-all-cards',
        async({ params, body, status, user }) => {
            const { listId: sourceListId } = params
            const { targetListId } = body
            const userId = user.id

            // Validate source and target lists
            const [sourceList, targetList] = await Promise.all([
                prisma.list.findUnique({
                    where: {
                        id: sourceListId
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
                        }
                    }
                }),
                prisma.list.findUnique({
                    where: {
                        id: targetListId
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
                        }
                    }
                })
            ])
            if (!sourceList || !targetList) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'Source or target list does not exist'
                })
            }
            if (sourceListId === targetListId) {
                return status('Bad Request', {
                    code: ERROR_CODES.LIST.INVALID_MOVE,
                    message: 'Cannot move cards to the same list'
                })
            }

            // Permission check (must be member of both workspaces)
            const isMemberSource = sourceList.board.workspace.members.some((m) => m.userId === userId)
            const isMemberTarget = targetList.board.workspace.members.some((m) => m.userId === userId)
            if (!isMemberSource || !isMemberTarget) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of both source and target workspaces'
                })
            }

            // Find all cards in source list
            const cards = await prisma.card.findMany({
                where: {
                    listId: sourceListId
                },
                orderBy: {
                    order: 'asc'
                }
            })
            if (!cards.length) {
                return status('OK', {
                    data: true,
                    affected: 0,
                    status: 200
                })
            }

            // Find max order in target list
            const maxOrder = await prisma.card.aggregate({
                where: {
                    listId: targetListId
                },
                _max: {
                    order: true
                }
            })
            let nextOrder = (maxOrder._max.order ?? 0) + 1

            try {
                // Move each card to target list, assign new order and boardId
                await prisma.$transaction(
                    cards.map((card) =>
                        prisma.card.update({
                            where: {
                                id: card.id
                            },
                            data: {
                                listId: targetListId,
                                boardId: targetList.boardId,
                                order: nextOrder++ // increment for each card
                            }
                        }))
                )

                // Log activity (optional: log in both boards if needed)
                await prisma.boardActivity.create({
                    data: {
                        boardId: targetList.boardId,
                        userId,
                        action: 'move_all_cards_in_list',
                        detail: `Moved all cards from list "${sourceList.name}" to list "${targetList.name}"`
                    }
                })

                return status('OK', {
                    data: true,
                    affected: cards.length,
                    status: 200
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                targetListId: t.String()
            }),
            detail: {
                tags: ['List'],
                summary: 'Move all cards from a list to another list',
                description: 'Move all cards from the source list to the target list. Cards will be placed at the end of the target list. User must be a member of both workspaces.'
            }
        }
    )
