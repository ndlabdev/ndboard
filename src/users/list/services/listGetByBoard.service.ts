// ** Elysia Imports
import { Elysia, t } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const listGetByBoard = new Elysia()
    .use(authUserPlugin)
    .get(
        '/',
        async ({ query, status, user }) => {
            const { boardId } = query
            const userId = user.id

            // Check if board exists, include workspace members for permission check
            const board = await prisma.board.findUnique({
                where: { id: boardId },
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

            // Check if user is a member of the workspace
            const isMember = board.workspace.members.some(m => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            try {
                // Get all lists by boardId, sorted by order ascending
                const lists = await prisma.list.findMany({
                    where: { boardId },
                    orderBy: { order: 'asc' }
                })

                return status('OK', {
                    data: lists.map(list => ({
                        id: list.id,
                        name: list.name,
                        boardId: list.boardId,
                        order: list.order,
                        createdAt: list.createdAt,
                        updatedAt: list.updatedAt
                    }))
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            query: t.Object({
                boardId: t.String()
            }),
            detail: {
                tags: ['List'],
                summary: 'Get all lists in a board',
                description: 'Return all lists in a board, sorted by order ascending. User must be a member of the board’s workspace.'
            }
        }
    )
