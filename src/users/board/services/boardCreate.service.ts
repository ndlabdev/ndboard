// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Third Party Imports
import slug from 'slug'
import { createId as cuid2 } from '@paralleldrive/cuid2'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import {
    BOARD_VISIBILITY, DEFAULT_BOARD_LABELS, DEFAULT_BOARD_LISTS,
    DEFAULT_CARDS
} from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

// Helper to generate unique shortLink (using cuid2, take 8 chars)
async function generateUniqueShortLink(): Promise<string> {
    let shortLink: string
    while (true) {
        shortLink = cuid2().slice(0, 8)
        const exist = await prisma.board.findUnique({
            where: {
                shortLink
            }
        })
        if (!exist) break
    }

    return shortLink
}

export const boardCreate = new Elysia()
    .use(authUserPlugin)
    .post(
        '/',
        async({ body, status, user }) => {
            const { name, description, workspaceId, visibility, coverImageUrl } = body
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
                // Generate shortLink and slug for the new board
                const shortLink = await generateUniqueShortLink()
                const boardSlug = slug(name)

                const newBoard = await prisma.$transaction(async(trx) => {
                    // Create the new board
                    const board = await trx.board.create({
                        data: {
                            name,
                            description,
                            workspaceId,
                            coverImageUrl,
                            ownerId: userId,
                            createdById: userId,
                            updatedById: userId,
                            visibility: visibility || BOARD_VISIBILITY.PRIVATE,
                            shortLink,
                            slug: boardSlug
                        }
                    })

                    // Create default lists for the new board
                    await trx.list.createMany({
                        data: DEFAULT_BOARD_LISTS.map((list) => ({
                            boardId: board.id,
                            name: list.name,
                            order: list.order,
                            createdById: board.ownerId,
                            updatedById: board.ownerId
                        }))
                    })

                    // Retrieve the newly created lists since createMany does not return inserted rows
                    const createdLists = await trx.list.findMany({
                        where: {
                            boardId: board.id
                        }
                    })

                    // Create default cards for each list, based on the list name mapping
                    for (const defaultCardSet of DEFAULT_CARDS) {
                        const list = createdLists.find((l) => l.name === defaultCardSet.listName)
                        if (list) {
                            await trx.card.createMany({
                                data: defaultCardSet.cards.map((card, idx) => ({
                                    listId: list.id,
                                    boardId: board.id,
                                    name: card.name,
                                    description: card.description,
                                    order: idx,
                                    createdById: board.ownerId,
                                    updatedById: board.ownerId
                                }))
                            })
                        }
                    }

                    // Create default labels for the new board
                    await trx.boardLabel.createMany({
                        data: DEFAULT_BOARD_LABELS.map((label) => ({
                            boardId: board.id,
                            name: label.name,
                            color: label.color,
                            tone: label.tone
                        }))
                    })

                    // Create board activity log for creation
                    await trx.boardActivity.create({
                        data: {
                            boardId: board.id,
                            userId,
                            action: 'create',
                            detail: `Created board "${name}"`
                        }
                    })

                    return board
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
                coverImageUrl: t.Optional(t.String()),
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
