// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'
import { MemberRole } from '@prisma/client'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Models Imports
import { cardModels } from '../card.model'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const cardCreate = new Elysia()
    .use(authUserPlugin)
    .use(cardModels)
    .post(
        '/',
        async ({ body, status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const { title, listId, description } = body

            // Check list exists and get list with board info
            const list = await prisma.list.findUnique({
                where: { id: listId },
                include: {
                    board: {
                        include: {
                            members: true
                        }
                    }
                }
            })

            if (!list) {
                return status('Not Found', {
                    code: ERROR_CODES.LIST_NOT_FOUND,
                    message: 'List does not exist'
                })
            }

            // Check board archived
            if (list.board.archivedAt) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD_ARCHIVED,
                    message: 'Board has been archived'
                })
            }

            // Check permission: must be board member
            const isMember = list.board.members.some(
                (m) => m.userId === user.id && m.role !== MemberRole.OBSERVER
            )

            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.PERMISSION_DENIED,
                    message: 'You do not have permission to add cards to this list'
                })
            }

            // calc order card
            const maxOrder = await prisma.card.aggregate({
                where: { listId: body.listId },
                _max: { order: true }
            })

            const newOrder = (maxOrder._max.order ?? 0) + 1

            try {
                const card = await prisma.card.create({
                    data: {
                        title,
                        description,
                        listId,
                        order: newOrder,
                        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
                        createdBy: user.id
                    },
                    include: {
                        labels: true,
                        list: true
                    }
                })

                return status('Created', { card })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'cardCreate'
        }
    )
