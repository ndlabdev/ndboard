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

export const cardAddComment = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:cardId/comments',
        async({ body, params, status, user }) => {
            const { cardId } = params
            const userId = user.id
            const { content } = body

            // Find card and check permission
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

            const isBoardMember = card.list.board.members.some((m) => m.userId === userId)
            const isWorkspaceMember = card.list.board.workspace.members.some((m) => m.userId === userId)
            if (!isBoardMember && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You are not a member of this board or its workspace'
                })
            }

            try {
                const result = await prisma.$transaction(async(tx) => {
                    // Create comment
                    const comment = await tx.cardComment.create({
                        data: {
                            cardId, userId, content
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    })

                    // Log activity
                    await tx.boardActivity.create({
                        data: {
                            boardId: card.list.boardId,
                            userId,
                            action: 'add_comment',
                            detail: `Commented on card "${card.name}"`
                        }
                    })
                    const activities = await tx.cardActivity.create({
                        data: {
                            cardId,
                            userId,
                            action: 'add_comment',
                            detail: 'Added a comment'
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    })

                    return {
                        ...comment,
                        activities
                    }
                })

                return status('OK', {
                    data: result
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                content: t.String({
                    minLength: 1
                })
            }),
            detail: {
                tags: ['Card'],
                summary: 'Add comment to card',
                description: 'Add a new comment to a card. Logs activity to board & card.'
            }
        }
    )
