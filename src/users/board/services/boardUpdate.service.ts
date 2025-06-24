// ** Elysia Imports
import { Elysia, t } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_VISIBILITY } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardUpdate = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:boardId',
        async ({ status, params, body, user }) => {
            const { name, description, visibility } = body
            const { boardId } = params
            const userId = user.id

            // Find board and include owner & workspace
            const board = await prisma.board.findUnique({
                where: { id: boardId },
                include: {
                    workspace: true
                }
            })
            if (!board) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.NOT_FOUND,
                    message: 'Board does not exist'
                })
            }

            // Check permission: only owner
            if (board.ownerId !== userId) {
                return status('Not Found', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to update this board'
                })
            }

            // Check duplicate board name in workspace if name is changing
            if (name && name !== board.name) {
                const existBoard = await prisma.board.findFirst({
                    where: {
                        workspaceId: board.workspaceId,
                        name
                    }
                })
                if (existBoard) {
                    return status('Conflict', {
                        code: ERROR_CODES.BOARD.NAME_EXISTS,
                        message: 'A board with this name already exists in the workspace'
                    })

                }
            }

            try {
                const updated = await prisma.board.update({
                    where: { id: boardId },
                    data: {
                        name,
                        description,
                        visibility,
                        updatedById: userId
                    }
                })

                return status('OK', {
                    data: updated
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
                description: t.Optional(t.String({ maxLength: 255 })),
                visibility: t.Optional(t.Enum(BOARD_VISIBILITY))
            }),
            detail: {
                tags: ['Board'],
                summary: 'Update board',
                description: 'Update board information (name, description, visibility). Only board owner can update.'
            }
        }
    )
