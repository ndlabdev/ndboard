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

export const cardReorder = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/reorder',
        async({ body, status, user }) => {
            const { cards, listId } = body
            const userId = user.id

            // Check list exist, permission
            const list = await prisma.list.findUnique({
                where: {
                    id: listId
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

            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Permission check
            const isBoardMember = list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // Archived check
            if (list.isArchived || list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.ARCHIVED,
                    message: 'Cannot reorder cards in archived list/board'
                })
            }

            // Validate cards array
            if (!Array.isArray(cards) || cards.length === 0) {
                return status('Bad Request', {
                    code: ERROR_CODES.CARD.INVALID_ORDER,
                    message: 'Cards array is required'
                })
            }

            try {
                // Transaction: bulk update card order
                await prisma.$transaction(async(tx) => {
                    for (let i = 0; i < cards.length; i++) {
                        const { id } = cards[i]

                        await tx.card.update({
                            where: {
                                id
                            },
                            data: {
                                order: i,
                                listId
                            }
                        })
                    }

                    // Log activity (optional)
                    await tx.boardActivity.create({
                        data: {
                            boardId: list.boardId,
                            userId,
                            action: 'bulk_reorder_card',
                            detail: `Bulk reorder ${cards.length} cards in list "${list.name}"`
                        }
                    })
                })

                return status('OK', {
                    data: true,
                    message: 'Card reorder successfully!'
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                listId: t.String(),
                cards: t.Array(
                    t.Object({
                        id: t.String(),
                        order: t.Integer()
                    })
                )
            }),
            detail: {
                tags: ['Card'],
                summary: 'Bulk reorder all cards in a list',
                description: 'Reorder all cards in a list by providing an array of {id, order}. Update all order values in one transaction. Only board/workspace members can reorder.'
            }
        }
    )
