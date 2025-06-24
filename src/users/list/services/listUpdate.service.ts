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

export const listUpdate = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:listId',
        async({ status, params, body, user }) => {
            const { listId } = params
            const { name, order } = body
            const userId = user.id

            // Check if list exists
            const list = await prisma.list.findUnique({
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
                    }
                }
            })
            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Check permission: must be member of workspace
            const isMember = list.board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            // Check for duplicate list name in the same board
            if (name && name !== list.name) {
                const nameExists = await prisma.list.findFirst({
                    where: {
                        boardId: list.boardId,
                        name,
                        NOT: {
                            id: listId
                        }
                    }
                })
                if (nameExists) {
                    return status('Conflict', {
                        code: ERROR_CODES.LIST.NAME_EXISTS,
                        message: 'A list with this name already exists in the board'
                    })
                }
            }

            try {
                // Prepare update data
                const updateData: typeof body & { updatedById: string } = {
                    updatedById: userId
                }

                if (name) updateData.name = name
                if (typeof order === 'number') updateData.order = order

                // Update list
                const updatedList = await prisma.list.update({
                    where: {
                        id: listId
                    },
                    data: updateData
                })

                return status('OK', {
                    data: {
                        id: updatedList.id,
                        name: updatedList.name,
                        boardId: updatedList.boardId,
                        order: updatedList.order,
                        createdAt: updatedList.createdAt,
                        updatedAt: updatedList.updatedAt
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.Optional(t.String({
                    minLength: 1, maxLength: 100
                })),
                order: t.Optional(t.Integer())
            }),
            detail: {
                tags: ['List'],
                summary: 'Update a list',
                description: 'Update a list’s name or order. User must be a member of the board’s workspace. List name must be unique within the board.'
            }
        }
    )
