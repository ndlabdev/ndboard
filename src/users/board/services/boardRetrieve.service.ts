// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { BoardVisibility, MemberRole } from '@prisma/client';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardRetrieve = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:boardId',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const board = await prisma.board.findUnique({
                where: { id: params.boardId },
                include: {
                    lists: {
                        orderBy: { position: 'asc' },
                        include: {
                            _count: {
                                select: {
                                    cards: true
                                }
                            }
                        }
                    },
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatar: true
                                }
                            }
                        }
                    },
                    owner: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true
                        }
                    },
                    labels: true,
                    _count: {
                        select: {
                            lists: true,
                            card: true,
                            members: true
                        }
                    }
                }
            })

            if (!board || board.deletedAt) {
                return status('Not Found', {
                    code: ERROR_CODES.NOT_FOUND,
                    message: 'Board not found'
                })
            }

            const isMember = board.members.some(m => m.userId === user.id)
            if (board.visibility === BoardVisibility.PRIVATE && !isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Access denied to this board'
                })
            }

            return {
                data: {
                    id: board.id,
                    name: board.name,
                    description: board.description,
                    visibility: board.visibility,
                    archivedAt: board.archivedAt,
                    updatedAt: board.updatedAt,
                    createdAt: board.createdAt,
                    owner: board.owner,
                    role: board.members.find(m => m.userId === user.id)?.role ?? MemberRole.GUEST,
                    members: board.members.map(m => ({
                        id: m.user.id,
                        name: m.user.name,
                        avatar: m.user.avatar,
                        role: m.role
                    })),
                    listCount: board._count.lists,
                    cardCount: board._count.card,
                    memberCount: board._count.members,
                    lists: board.lists.map(list => ({
                        id: list.id,
                        name: list.name,
                        position: list.position,
                        cardCount: list._count.cards
                    })),
                    labels: board.labels
                }
            }
        }
    )
