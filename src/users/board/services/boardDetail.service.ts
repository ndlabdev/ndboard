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
                        where: {
                            isArchived: false
                        },
                        orderBy: {
                            order: 'asc'
                        },
                        select: {
                            id: true,
                            name: true,
                            order: true,
                            isFold: true,
                            isArchived: true,
                            boardId: true,
                            _count: {
                                select: {
                                    cards: true
                                }
                            }
                        }
                    },
                    members: {
                        select: {
                            role: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true
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

            // Check if user favorited this board
            const boardFavorite = await prisma.boardFavorite.findUnique({
                where: {
                    boardId_userId: {
                        boardId: board.id,
                        userId
                    }
                }
            })

            // Prepare response data
            const { owner, workspace, labels, lists, members, ...boardData } = board

            return status('OK', {
                data: {
                    ...boardData,
                    owner,
                    workspace: {
                        id: workspace.id,
                        name: workspace.name
                    },
                    labels,
                    lists,
                    members: members.map((m) => ({
                        userId: m.user.id,
                        name: m.user.name,
                        email: m.user.email,
                        avatarUrl: m.user.avatarUrl,
                        role: m.role
                    })),
                    isFavorite: !!boardFavorite
                }
            })
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Get board detail (no cards)',
                description: 'Retrieve board detail and lists only. User must be a workspace member or board must be public.'
            }
        }
    )
