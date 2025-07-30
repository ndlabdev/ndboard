// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import {
    LABEL_COLOR_NAMES,
    LABEL_TONES
} from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardCreateLabel = new Elysia()
    .use(authUserPlugin)
    .post(
        '/labels',
        async({ body, status, user }) => {
            const { name, color, tone, boardId } = body
            const userId = user.id

            // Check if the board exists
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
                    message: 'The specified board does not exist.'
                })
            }

            // Check if user is a member of the board's workspace
            const isMember = board.workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of the board workspace.'
                })
            }

            try {
                // Create new label for the board
                const newLabel = await prisma.boardLabel.create({
                    data: {
                        boardId,
                        name,
                        color,
                        tone
                    }
                })

                // Optionally log activity (uncomment if needed)
                await prisma.boardActivity.create({
                    data: {
                        boardId,
                        userId,
                        action: 'create_label',
                        detail: `Created label "${name}" for board "${board.name}"`
                    }
                })

                return status('Created', {
                    data: newLabel
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.String(),
                color: t.Enum(LABEL_COLOR_NAMES),
                tone: t.Enum(LABEL_TONES),
                boardId: t.String()
            }),
            detail: {
                tags: ['Label'],
                summary: 'Create a new board label',
                description: 'Create a new label for a board. Label name must be unique within the board. Only members of the workspace can create labels.'
            }
        }
    )
