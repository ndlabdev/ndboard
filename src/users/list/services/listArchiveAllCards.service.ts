// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const listArchiveAllCards = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:listId/archive-all-cards',
        async({ params, status, user }) => {
            const { listId } = params
            const userId = user.id

            // Find the list and its board/workspace for permission check
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

            // Check if user is a member of the workspace
            const isMember = list.board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            try {
                // Archive all cards in the list (batch update)
                const result = await prisma.card.updateMany({
                    where: {
                        listId: listId, isArchived: false
                    },
                    data: {
                        isArchived: true
                    }
                })

                // Log board activity for bulk archive
                await prisma.boardActivity.create({
                    data: {
                        boardId: list.boardId,
                        userId,
                        action: 'archive_all_cards_in_list',
                        detail: `Archived all cards in list "${list.name}"`
                    }
                })

                return status('OK', {
                    data: true,
                    affected: result.count,
                    status: 200
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['List'],
                summary: 'Archive all cards in a list',
                description: 'Archive all cards in a given list. User must be a member of the workspace. Operation will not affect already archived cards.'
            }
        }
    )
