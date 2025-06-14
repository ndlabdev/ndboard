// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { BoardVisibility, MemberRole, Prisma } from '@prisma/client';

// ** Constants Imports
import { PAGE } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { boardModels } from './board.model';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardCreate = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .post(
        '/',
        async ({ body, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const exist = await prisma.board.findFirst({
                where: {
                    name: body.name,
                    ownerId: user.id,
                    archivedAt: null
                }
            })

            if (exist) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD_NAME_DUPLICATED,
                    message: 'Board name already exists for this user'
                })
            }

            try {
                const board = await prisma.board.create({
                    data: {
                        ...body,
                        ownerId: user.id,
                        members: {
                            create: [{
                                userId: user.id,
                                role: MemberRole.OWNER,
                            }]
                        }
                    },
                    include: { members: true }
                })

                return status('Created', { board })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'boardCreate'
        }
    )

export const boardGetAll = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .get(
        '/',
        async ({ query, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const page = Number(query.page) || PAGE.CURRENT
            const pageSize = Number(query.pageSize) || PAGE.SIZE

            const skip = ((page - 1) * pageSize) || undefined
            const take = pageSize || undefined

            const search: Prisma.BoardWhereInput = {
                deletedAt: null,
                members: {
                    some: {
                        userId: user.id,
                        ...(query.role ? { role: query.role } : {})
                    }
                },
                name: {
                    contains: query.name || undefined,
                    mode: 'insensitive'
                },
                ...(query.visibility ? { visibility: query.visibility } : {}),
                ...(query.archived
                    ? { archivedAt: { not: null } }
                    : { archivedAt: null })
            }

            try {
                const [data, total] = await Promise.all([
                    prisma.board.findMany({
                        take,
                        skip,
                        orderBy: {
                            updatedAt: 'desc'
                        },
                        where: search,
                        include: {
                            members: {
                                where: {
                                    userId: user.id
                                },
                                select: {
                                    role: true
                                }
                            },
                            _count: {
                                select: {
                                    lists: true,
                                    card: true
                                }
                            },
                            owner: {
                                select: {
                                    id: true,
                                    name: true,
                                    avatar: true
                                }
                            },
                        }
                    }),
                    prisma.board.count({
                        where: search
                    })
                ])

                return status('OK', {
                    data,
                    meta: {
                        total,
                        page,
                        pageSize,
                        totalPages: Math.ceil(total / pageSize)
                    }
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: 'boardSearch'
        }
    )

export const boardRetrieve = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:id',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const board = await prisma.board.findUnique({
                where: { id: params.id },
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

export const boardUpdate = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .patch(
        '/:id',
        async ({ body, params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const board = await prisma.board.findUnique({
                where: { id: params.id },
                include: {
                    members: {
                        where: {
                            userId: user.id
                        },
                        select: {
                            role: true
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

            function isAdminOrOwner(role: MemberRole | undefined): boolean {
                return role === MemberRole.ADMIN || role === MemberRole.OWNER;
            }

            const role = board.members[0]?.role;
            if (!isAdminOrOwner(role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Not allowed to update board'
                });
            }

            const updatedBoard = await prisma.board.update({
                where: { id: params.id },
                data: {
                    ...(body.name ? { name: body.name } : {}),
                    ...(body.description ? { description: body.description } : {}),
                    ...(body.visibility ? { visibility: body.visibility } : {})
                }
            })

            return {
                data: updatedBoard
            }
        },
        {
            body: 'boardUpdate'
        }
    )

export const boardArchive = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:id',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const board = await prisma.board.findUnique({
                where: { id: params.id },
                include: {
                    members: {
                        where: {
                            userId: user.id
                        },
                        select: {
                            role: true
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

            function isAdminOrOwner(role: MemberRole | undefined): boolean {
                return role === MemberRole.ADMIN || role === MemberRole.OWNER;
            }

            const role = board.members[0]?.role;
            if (!isAdminOrOwner(role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Not allowed to update board'
                });
            }

            return await prisma.board.update({
                where: { id: params.id },
                data: {
                    deletedAt: new Date()
                },
                select: {
                    id: true
                }
            })
        }
    )

export const boardLeave = new Elysia()
    .use(authUserPlugin)
    .post(
        '/:id/leave',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const member = await prisma.boardMember.findFirst({
                where: {
                    boardId: params.id,
                    userId: user.id
                }
            })

            if (!member) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not a member of this board'
                })
            }

            if (member.role === MemberRole.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Owner cannot leave board'
                })
            }

            return await prisma.boardMember.delete({
                where: {
                    id: member.id
                },
                select: {
                    id: true
                }
            })
        }
    )

export const boardInviteMember = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .post(
        '/:id/invite',
        async ({ params, body, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const myMember = await prisma.boardMember.findFirst({
                where: {
                    boardId: params.id,
                    userId: user.id
                }
            })

            function isAdminOrOwner(role: MemberRole | undefined): boolean {
                return role === MemberRole.ADMIN || role === MemberRole.OWNER;
            }

            if (!myMember || !isAdminOrOwner(myMember.role)) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not allowed to invite members'
                });
            }

            const invitedUser = await prisma.user.findUnique({
                where: {
                    id: body.userId
                }
            })

            if (!invitedUser) {
                return status('Not Found', {
                    code: ERROR_CODES.NOT_FOUND,
                    message: 'User to invite not found'
                });
            }

            const alreadyMember = await prisma.boardMember.findFirst({
                where: {
                    boardId: params.id,
                    userId: body.userId
                }
            })

            if (alreadyMember) {
                return status('Conflict', {
                    code: ERROR_CODES.ALREADY_MEMBER,
                    message: 'User is already a member of this board'
                });
            }

            const member = await prisma.boardMember.create({
                data: {
                    boardId: params.id,
                    userId: body.userId,
                    role: body.role
                }
            })

            return {
                data: {
                    memberId: member.id,
                    userId: member.userId,
                    boardId: member.boardId,
                    role: member.role,
                    status: 'JOINED'
                }
            }
        },
        {
            body: 'boardInviteMember'
        }
    )

export const boardKichMember = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/board/:boardId/member/:userId',
        async ({ params, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId, userId: targetUserId } = params

            // Get the acting member (the one performing the action)
            const actor = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: user.id
                }
            })

            if (!actor) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not a member of this board'
                })
            }

            // Get the target member (the one to be removed)
            const target = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: targetUserId
                }
            })

            if (!target) {
                return status('Not Found', {
                    code: ERROR_CODES.USER_NOT_FOUND,
                    message: 'Member not found in this board'
                })
            }

            // Prevent removing the owner
            if (target.role === MemberRole.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.CANNOT_REMOVE_OWNER,
                    message: 'Cannot remove owner from board'
                })
            }

            // Prevent self-removal with this API (use leave board instead)
            if (user.id === targetUserId) {
                return status('Bad Request', {
                    code: ERROR_CODES.CANNOT_SELF_REMOVE,
                    message: 'Use leave board to remove yourself'
                })
            }

            // Rule: ADMIN can only remove MEMBER/GUEST/OBSERVER, OWNER can remove all except OWNER
            if (actor.role === MemberRole.ADMIN) {
                function isNoAdminOrOwner(role: MemberRole | undefined): boolean {
                    return role === MemberRole.MEMBER || role === MemberRole.GUEST || role === MemberRole.OBSERVER;
                }

                if (!isNoAdminOrOwner(target.role)) {
                    return status('Forbidden', {
                        code: ERROR_CODES.FORBIDDEN,
                        message: 'You are not allowed to remove this member'
                    })
                }
            }

            return await prisma.boardMember.delete({
                where: {
                    id: target.id
                }
            })
        }
    )

export const boardChangeMemberRole = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .patch(
        '/board/:boardId/member/:userId/role',
        async ({ params, body, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { boardId, userId: targetUserId } = params

            // Get the acting member (the one performing the action)
            const actor = await prisma.boardMember.findFirst({
                where: { boardId, userId: user.id }
            })

            if (!actor) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'You are not a member of this board'
                })
            }

            // Get the target member
            const target = await prisma.boardMember.findFirst({
                where: { boardId, userId: targetUserId }
            })

            if (!target) {
                return status('Not Found', {
                    code: ERROR_CODES.USER_NOT_FOUND,
                    message: 'Member not found in this board'
                })
            }

            // Prevent changing the owner role
            if (target.role === MemberRole.OWNER) {
                return status('Forbidden', {
                    code: ERROR_CODES.CANNOT_REMOVE_OWNER,
                    message: 'Cannot change the owner role'
                })
            }

            // Prevent self role change
            if (user.id === targetUserId) {
                return status('Bad Request', {
                    code: ERROR_CODES.CANNOT_SELF_REMOVE,
                    message: 'Use another action to change your own role'
                })
            }

            // ADMIN cannot change role of ADMIN or higher
            if (actor.role === MemberRole.ADMIN) {
                function isAdminOrOwner(role: MemberRole | undefined): boolean {
                    return role === MemberRole.ADMIN || role === MemberRole.OWNER;
                }


                if (isAdminOrOwner(target.role)) {
                    return status('Forbidden', {
                        code: ERROR_CODES.FORBIDDEN,
                        message: 'You are not allowed to change this member role'
                    });
                }
            }

            // OWNER can change any role (except OWNER)
            const oldRole = target.role
            const newRole = body.role

            if (oldRole === newRole) {
                return status('OK', {
                    data: {
                        userId: targetUserId,
                        oldRole,
                        newRole
                    }
                })
            }

            await prisma.boardMember.update({
                where: { id: target.id },
                data: { role: newRole }
            })

            return status('OK', {
                data: {
                    userId: targetUserId,
                    oldRole,
                    newRole
                }
            })
        },
        {
            body: 'boardChangeMemberRole'
        }
    )

export const boardTransferOwner = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .post(
        '/:id/transfer-owner',
        async ({ params, body, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const boardId = params.id
            const targetUserId = body.userId

            // Get current owner
            const owner = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: user.id,
                    role: MemberRole.OWNER
                }
            })

            if (!owner) {
                return status('Forbidden', {
                    code: ERROR_CODES.TRANSFER_OWNER_NOT_ALLOWED,
                    message: 'Only the current owner can transfer ownership'
                })
            }

            // Cannot transfer to self
            if (user.id === targetUserId) {
                return status('Bad Request', {
                    code: ERROR_CODES.TRANSFER_OWNER_NOT_ALLOWED,
                    message: 'Cannot transfer ownership to yourself'
                })
            }

            // Check if new owner is a member and not already owner
            const targetMember = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: targetUserId
                }
            })

            if (!targetMember) {
                return status('Not Found', {
                    code: ERROR_CODES.NOT_FOUND,
                    message: 'Target user is not a member of this board'
                })
            }

            if (targetMember.role === MemberRole.OWNER) {
                return status('Not Found', {
                    code: ERROR_CODES.ALREADY_OWNER,
                    message: 'Target user is already the owner'
                })
            }

            // Transfer roles atomically (transaction)
            await prisma.$transaction([
                prisma.boardMember.update({
                    where: { id: owner.id },
                    data: { role: MemberRole.ADMIN }
                }),
                prisma.boardMember.update({
                    where: { id: targetMember.id },
                    data: { role: MemberRole.OWNER }
                })
            ])

            return status('OK', {
                data: {
                    oldOwnerId: owner.userId,
                    newOwnerId: targetMember.userId
                }
            })
        },
        {
            body: 'boardTransferOwner'
        }
    )
