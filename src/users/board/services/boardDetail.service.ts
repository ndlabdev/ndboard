// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_VISIBILITY } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardDetail = new Elysia()
    .use(authUserPlugin)
    .get(
        '/:shortLink',
        async({ status, params, user }) => {
            const { shortLink } = params
            const userId = user.id

            // Find board and include owner & workspace
            const board = await prisma.board.findUnique({
                where: {
                    shortLink
                },
                include: {
                    owner: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            members: true
                        }
                    },
                    labels: true,
                    lists: {
                        orderBy: {
                            order: 'asc'
                        },
                        select: {
                            id: true,
                            name: true,
                            order: true,
                            isArchived: true
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

            // Check permission: user must be member of workspace or board is public
            const isWorkspaceMember = board.workspace.members.some((m) => m.userId === userId)
            const isBoardPublic = board.visibility === BOARD_VISIBILITY.PUBLIC

            if (!isBoardPublic && !isWorkspaceMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.BOARD.FORBIDDEN,
                    message: 'You do not have permission to view this board'
                })
            }

            // Prepare response data
            const { owner, workspace, labels, lists, ...boardData } = board

            return status('OK', {
                data: {
                    ...boardData,
                    owner,
                    workspace: {
                        id: workspace.id,
                        name: workspace.name
                    },
                    labels,
                    lists
                }
            })
        },
        {
            detail: {
                tags: ['Board'],
                summary: 'Get board detail (no cards)',
                description: 'Retrieve board detail and lists only. User must be a workspace member or board must be public.'
            }
        }
    )
