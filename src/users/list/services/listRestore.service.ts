// ** Elysia Imports
import { Elysia, t } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const listRestore = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:listId/restore',
        async ({ params, status, user }) => {
            const { listId } = params
            const userId = user.id

            // Check if list exists
            const list = await prisma.list.findUnique({
                where: { id: listId },
                include: {
                    board: {
                        include: {
                            workspace: {
                                include: { members: true }
                            }
                        }
                    }
                }
            })
            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST.NOT_FOUND,
                    message: 'List does not exist',
                })
            }

            // Check permission: must be member of workspace
            const isMember = list.board.workspace.members.some(m => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace',
                })
            }

            if (!list.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.NOT_ARCHIVED,
                    message: 'List is not archived',
                })
            }

            try {
                // Restore the list (un-archive)
                const updatedList = await prisma.list.update({
                    where: { id: listId },
                    data: {
                        isArchived: false,
                        archivedAt: null,
                        updatedById: userId
                    }
                })

                // Restore all cards in this list (unarchive cards)
                // await prisma.card.updateMany({
                //     where: { listId: id },
                //     data: { isArchived: false }
                // })

                return status('OK', {
                    data: {
                        id: updatedList.id,
                    }
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
                summary: 'Restore an archived list',
                description: 'Restore a list (set isArchived=false) and all its cards. User must be a member of the board’s workspace.'
            },
        }
    )
