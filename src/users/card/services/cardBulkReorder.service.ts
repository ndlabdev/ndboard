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

export const cardBulkReorder = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/bulk-reorder',
        async({ body, status, user }) => {
            const { lists } = body
            const userId = user.id

            // Validate input: must have lists and at least one card per list
            if (!Array.isArray(lists) || lists.length === 0) {
                return status('Bad Request', {
                    code: ERROR_CODES.CARD.INVALID_ORDER,
                    message: 'Lists array is required',
                    status: 400
                })
            }

            // Fetch all involved lists and check permissions
            const listIds = lists.map((l) => l.listId)
            const dbLists = await prisma.list.findMany({
                where: {
                    id: {
                        in: listIds
                    }
                },
                include: {
                    board: {
                        include: {
                            members: true,
                            workspace: {
                                include: {
                                    members: true
                                }
                            }
                        }
                    }
                }
            })

            if (dbLists.length !== listIds.length) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'One or more lists do not exist'
                })
            }

            // Permission & archived check for all lists
            for (const list of dbLists) {
                const isBoardMember = list.board.members.some((m) => m.userId === userId)
                const isWorkspaceMember = list.board.workspace.members.some((m) => m.userId === userId)
                if (!isBoardMember && !isWorkspaceMember) {
                    return status('Forbidden', {
                        code: ERROR_CODES.BOARD.FORBIDDEN,
                        message: `You are not a member of the board or workspace for list "${list.name}"`
                    })
                }
                if (list.isArchived || list.board.isArchived) {
                    return status('Conflict', {
                        code: ERROR_CODES.LIST.ARCHIVED,
                        message: `Cannot reorder cards in archived list/board ("${list.name}")`
                    })
                }
            }

            try {
                await prisma.$transaction(async(tx) => {
                    // Update order and listId for all cards in each list
                    for (const listInput of lists) {
                        const { listId, cards } = listInput

                        if (!Array.isArray(cards) || cards.length === 0) continue

                        for (const card of cards) {
                            await tx.card.update({
                                where: {
                                    id: card.id
                                },
                                data: {
                                    order: card.order,
                                    listId
                                }
                            })
                        }
                    }

                    // Log activity for each list
                    for (const listInput of lists) {
                        const dbList = dbLists.find((l) => l.id === listInput.listId)
                        if (dbList && listInput.cards.length > 0) {
                            await tx.boardActivity.create({
                                data: {
                                    boardId: dbList.boardId,
                                    userId,
                                    action: 'bulk_reorder_card',
                                    detail: `Bulk reorder ${listInput.cards.length} cards in list "${dbList.name}"`
                                }
                            })
                        }
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                lists: t.Array(
                    t.Object({
                        listId: t.String(),
                        cards: t.Array(
                            t.Object({
                                id: t.String(),
                                order: t.Integer()
                            })
                        )
                    })
                )
            }),
            detail: {
                tags: ['Card'],
                summary: 'Bulk reorder cards in one or more lists',
                description: 'Reorder cards within one or across multiple lists (drag & drop, move) by sending arrays of cards (id, order) per list. Only board/workspace members can reorder.'
            }
        }
    )
