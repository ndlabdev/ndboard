// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const listDelete = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:listId',
        async({ status, params, user }) => {
            const { listId } = params
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

            try {
                // Delete list and all child entities (cards, etc) - cascade handled by Prisma schema
                const deletedList = await prisma.list.delete({
                    where: {
                        id: listId
                    }
                })

                return status('OK', {
                    data: {
                        id: deletedList.id,
                        boardId: deletedList.boardId
                    }
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['List'],
                summary: 'Delete a list',
                description: 'Delete a list by id. User must be a member of the board’s workspace. All child entities (cards, checklist, etc.) will also be deleted by cascade.'
            }
        }
    )
