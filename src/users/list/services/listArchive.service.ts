// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const listArchive = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:listId/archive',
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

            if (list.isArchived) {
                return status('Conflict', {
                    code: ERROR_CODES.LIST.ALREADY_ARCHIVED,
                    message: 'List has already been archived',
                })
            }

            try {
                // Archive the list (soft delete)
                const updatedList = await prisma.list.update({
                    where: { id: listId },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        updatedById: userId
                    }
                })

                // archive all cards in this list (like Trello)
                // await prisma.card.updateMany({
                //     where: { listId: id },
                //     data: { isArchived: true }
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
            detail: {
                tags: ['List'],
                summary: 'Archive a list',
                description: 'Archive (soft delete) a list and all its cards. User must be a member of the board’s workspace.'
            },
        }
    )
