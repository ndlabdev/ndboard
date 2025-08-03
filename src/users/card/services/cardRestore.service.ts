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

export const cardRestore = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:cardId/restore',
        async({ params, status, user }) => {
            const { cardId } = params
            const userId = user.id

            // 1. Find card and all related entities for permission and state checking
            const card = await prisma.card.findUnique({
                where: {
                    id: cardId
                },
                include: {
                    list: {
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
                    }
                }
            })

            if (!card) {
                return status('Not Found', {
                    code: ERROR_CODES.CARD.NOT_FOUND,
                    message: 'Card does not exist'
                })
            }

            // 2. Permission: must be member of board or workspace
            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            // 3. Only allow restore if card is archived
            if (!card.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.CARD.NOT_ARCHIVED,
                    message: 'Card is not archived'
                })
            }

            // 4. Do not allow restore if list or board is archived
            if (card.list.isArchived || card.list.board.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.ARCHIVED,
                    message: 'Cannot restore card when its list or board is archived'
                })
            }

            try {
                // 5. Restore the card (set isArchived = false)
                const updatedCard = await prisma.card.update({
                    where: {
                        id: cardId
                    },
                    data: {
                        isArchived: false
                    },
                    include: {
                        labels: {
                            include: {
                                label: true
                            }
                        },
                        assignees: {
                            include: {
                                user: true
                            }
                        },
                        attachments: true,
                        customFieldValues: {
                            include: {
                                boardCustomField: true
                            }
                        }
                    }
                })

                // 6. Log restore activity (optional)
                await prisma.boardActivity.create({
                    data: {
                        boardId: card.list.boardId,
                        userId,
                        action: 'restore_card',
                        detail: `Restored card "${card.name}" to list "${card.list.name}"`
                    }
                })

                return status('OK', {
                    data: {
                        id: updatedCard.id,
                        name: updatedCard.name,
                        boardId: updatedCard.boardId,
                        description: updatedCard.description,
                        listId: updatedCard.listId,
                        dueDate: updatedCard.dueDate,
                        order: updatedCard.order,
                        isArchived: updatedCard.isArchived,
                        updatedAt: updatedCard.updatedAt
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['List'],
                summary: 'Restore an archived list',
                description: 'Restore a list (set isArchived=false) and all its cards. User must be a member of the board’s workspace.'
            }
        }
    )
