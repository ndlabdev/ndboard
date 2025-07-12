// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_VISIBILITY } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardDetail = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:shortLink',
        async({ status, params, user }) => {
            const { shortLink } = params
            const userId = user.id

            // Find board and include owner & workspace
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
                },
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            members: true
                        }
                    },
                    labels: true,
                    lists: {
                        orderBy: {
                            order: 'asc'
                        },
                        include: {
                            cards: {
                                orderBy: {
                                    order: 'asc'
                                },
                                include: {
                                    labels: {
                                        include: {
                                            label: true
                                        }
                                    },
                                    assignees: {
                                        include: {
                                            user: {
                                                select: {
                                                    id: true, name: true, avatarUrl: true
                                                }
                                            }
                                        }
                                    },
                                    checklists: {
                                        include: {
                                            items: true
                                        }
                                    },
                                    attachments: true,
                                    comments: {
                                        include: {
                                            user: {
                                                select: {
                                                    id: true, name: true, avatarUrl: true
                                                }
                                            }
                                        }
                                    },
                                    customFieldValues: true
                                }
                            }
                        }
                    }

                }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Check permission: user must be member of workspace or board is public
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            const isBoardPublic = board.visibility === BOARD_VISIBILITY.PUBLIC

            if (!isBoardPublic && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to view this board'
                })
            }

            // Prepare response data
            const { owner, workspace, labels, lists, ...boardData } = board

            return status('OK', {
                data: {
                    ...boardData,
                    owner,
                    workspace: {
                        id: workspace.id,
                        name: workspace.name
                    },
                    labels,
                    lists: lists.map((list) => ({
                        id: list.id,
                        name: list.name,
                        order: list.order,
                        isArchived: list.isArchived
                    })),
                    cards: lists
                        .flatMap((list) => list.cards.map((card) => ({
                            id: card.id,
                            name: card.name,
                            description: card.description,
                            listId: card.listId,
                            order: card.order,
                            dueDate: card.dueDate,
                            isArchived: card.isArchived,
                            labels: card.labels.map((l) => ({
                                id: l.label.id,
                                name: l.label.name,
                                color: l.label.color
                            })),
                            assignees: card.assignees.map((a) => ({
                                id: a.user.id,
                                name: a.user.name,
                                avatarUrl: a.user.avatarUrl
                            })),
                            checklists: card.checklists.map((cl) => ({
                                id: cl.id,
                                title: cl.title,
                                order: cl.order,
                                items: cl.items
                            })),
                            attachments: card.attachments,
                            comments: card.comments.map((cmt) => ({
                                id: cmt.id,
                                content: cmt.content,
                                createdAt: cmt.createdAt,
                                user: cmt.user
                            })),
                            customFieldValues: card.customFieldValues
                        })))
                }
            })
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Get board detail',
                description: 'Retrieve detail information of a board by its ID. User must be a workspace member or board must be public.'
            }
        }
    )
