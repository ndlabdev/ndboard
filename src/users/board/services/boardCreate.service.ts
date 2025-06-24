// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { BOARD_VISIBILITY } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardCreate = new Elysia()
    .use(authUserPlugin)
    .post(
        '/',
        async({ body, status, user }) => {
            const { name, description, workspaceId, visibility } = body
            const userId = user.id

            // Check if workspace exists and is active
            const workspace = await prisma.workspace.findUnique({
                where: {
                    id: workspaceId
                },
                include: {
                    members: true
                }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }

            // Check if user is a member of the workspace
            const isMember = workspace.members.some((m) => m.userId === userId)
            if (!isMember) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'You are not a member of this workspace'
                })
            }

            // Check for duplicate board name within the same workspace
            const existingBoard = await prisma.board.findFirst({
                where: {
                    name, workspaceId
                }
            })
            if (existingBoard) {
                return status('Conflict', {
                    code: ERROR_CODES.BOARD.NAME_EXISTS,
                    message: 'A board with this name already exists in the workspace'
                })
            }

            try {
                // Create the new board
                const newBoard = await prisma.board.create({
                    data: {
                        name,
                        description,
                        workspaceId,
                        ownerId: userId,
                        createdById: userId,
                        updatedById: userId,
                        visibility: visibility || BOARD_VISIBILITY.PRIVATE
                    }
                })

                await prisma.boardActivity.create({
                    data: {
                        boardId: newBoard.id,
                        userId,
                        action: 'create',
                        detail: `Created board "${name}"`
                    }
                })

                return status('Created', {
                    data: newBoard
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
                description: t.Optional(t.String({
                    maxLength: 255
                })),
                workspaceId: t.String(),
                visibility: t.Optional(
                    t.Enum(BOARD_VISIBILITY, {
                        default: BOARD_VISIBILITY.PRIVATE
                    })
                )
            }),
            detail: {
                tags: ['Board'],
                summary: 'Create a new board',
                description: 'Create a new board in a specific workspace. User must be a member of the workspace. Board name must be unique within the workspace.'
            }
        }
    )
