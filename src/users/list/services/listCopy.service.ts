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

export const listCopy = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:listId/copy',
        async({ params, body, status, user }) => {
            const { listId } = params
            const { name } = body
            const userId = user.id

            // Find the source list, including related board and workspace for permission check
            const srcList = await prisma.list.findUnique({
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
                    cards: {
                        orderBy: {
                            order: 'asc'
                        }
                    }
                }
            })
            if (!srcList) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Check if user is a member of the workspace
            const isMember = srcList.board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            try {
                // Calculate next order: insert right after the source list
                const newOrder = srcList.order + 1

                // Shift all lists with order > srcList.order by +1 (right shift)
                await prisma.list.updateMany({
                    where: {
                        boardId: srcList.boardId,
                        order: {
                            gt: srcList.order
                        }
                    },
                    data: {
                        order: {
                            increment: 1
                        }
                    }
                })

                // Determine the new list name (if not provided, add suffix " (Copy)")
                const listName = name ?? `${srcList.name} (Copy)`

                // Create the new list in the same board
                const newList = await prisma.list.create({
                    data: {
                        name: listName,
                        boardId: srcList.boardId,
                        order: newOrder,
                        createdById: userId,
                        updatedById: userId,
                        isArchived: false
                    }
                })

                // Copy all cards from the source list to the new list (excluding comments, attachments, activity)
                let newCardIds: string[] = []
                if (srcList.cards.length > 0) {
                    const createdCards = await prisma.$transaction(
                        srcList.cards.map((card) =>
                            prisma.card.create({
                                data: {
                                    name: card.name,
                                    description: card.description,
                                    listId: newList.id,
                                    boardId: srcList.boardId,
                                    order: card.order,
                                    isArchived: false,
                                    createdById: userId,
                                    updatedById: userId
                                }
                            }))
                    )
                    newCardIds = createdCards.map((c) => c.id)
                }

                // Log board activity for copying list
                await prisma.boardActivity.create({
                    data: {
                        boardId: srcList.boardId,
                        userId,
                        action: 'copy_list',
                        detail: `Copied list "${srcList.name}" to "${listName}"`
                    }
                })

                // Return the created list as response
                return status('OK', {
                    data: {
                        id: newList.id,
                        name: newList.name,
                        boardId: newList.boardId,
                        order: newList.order,
                        isFold: newList.isFold,
                        createdAt: newList.createdAt,
                        updatedAt: newList.updatedAt,
                        cardIds: newCardIds
                    },
                    status: 200
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.Optional(t.String({
                    minLength: 1, maxLength: 100
                }))
            }),
            detail: {
                tags: ['List'],
                summary: 'Copy a list (same board)',
                description: 'Copy a list and its cards to the same board (excluding comments, attachments, activity). User must be a member of the workspace. New list will be placed at the end of the board.'
            }
        }
    )
