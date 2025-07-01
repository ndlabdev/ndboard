// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Third Party Imports
import slug from 'slug'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceUpdate = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/:workspaceId',
        async({ status, params, body, user }) => {
            const { name, slug: wsSlug, imageUrl, description } = body
            const workspaceId = params.workspaceId
            const userId = user.id
            const workspaceSlug = slug(wsSlug)

            // Find the workspace and check if user is owner
            const workspace = await prisma.workspace.findUnique({
                where: {
                    id: workspaceId
                }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }
            if (workspace.ownerId !== userId) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'Only owner can update workspace info'
                })
            }

            // If name exists and want to be unique per user, check for duplicate
            if (workspaceSlug !== workspace.slug) {
                const existed = await prisma.workspace.findFirst({
                    where: {
                        OR: [
                            {
                                name
                            },
                            {
                                slug: workspaceSlug
                            }
                        ],
                        ownerId: userId,
                        NOT: {
                            id: workspaceId
                        }
                    }
                })
                if (existed) {
                    return status('Conflict', {
                        code: ERROR_CODES.WORKSPACE.NAME_DUPLICATE,
                        message: 'Workspace name already exists'
                    })
                }
            }

            try {
                const updated = await prisma.workspace.update({
                    where: {
                        id: workspaceId
                    },
                    data: {
                        name,
                        imageUrl,
                        slug: workspaceSlug,
                        description
                    }
                })

                return status('OK', {
                    data: updated
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
                slug: t.String({
                    minLength: 1, maxLength: 120
                }),
                description: t.Optional(t.String({
                    maxLength: 255
                })),
                imageUrl: t.Optional(t.String())
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Update workspace info',
                description: 'Only workspace owner can update name, description'
            }
        }
    )
