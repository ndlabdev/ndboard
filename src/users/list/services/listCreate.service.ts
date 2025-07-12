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

export const listCreate = new Elysia()
    .use(authUserPlugin)
    .post(
        '/',
        async({ body, status, user }) => {
            const { name, boardId } = body
            const userId = user.id

            // Check if board exists
            const board = await prisma.board.findUnique({
                where: {
                    id: boardId
                },
                include: {
                    workspace: {
                        include: {
                            members: true
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

            // Check if user is a member of the board's workspace
            const isMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            // Check for duplicate list name in the same board (optional, business logic)
            const existingList = await prisma.list.findFirst({
                where: {
                    name, boardId
                }
            })
            if (existingList) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.NAME_EXISTS,
                    message: 'A list with this name already exists in the board'
                })
            }

            try {
                // Get the highest current order in this board
                const maxOrder = await prisma.list.aggregate({
                    where: {
                        boardId
                    },
                    _max: {
                        order: true
                    }
                })
                const nextOrder = (maxOrder._max.order ?? 0) + 1

                // Create the new list
                const newList = await prisma.list.create({
                    data: {
                        name,
                        boardId,
                        order: nextOrder,
                        createdById: userId,
                        updatedById: userId
                    }
                })

                return status('Created', {
                    data: {
                        id: newList.id,
                        name: newList.name,
                        boardId: newList.boardId,
                        order: newList.order,
                        isArchived: newList.isArchived,
                        createdAt: newList.createdAt,
                        updatedAt: newList.updatedAt
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.String({
                    minLength: 1, maxLength: 100
                }),
                boardId: t.String({
                    minLength: 1
                })
            }),
            detail: {
                tags: ['List'],
                summary: 'Create a new list',
                description: 'Create a new list in a board. The list will be placed at the end. Only members with permission can create a list.'
            }
        }
    )
