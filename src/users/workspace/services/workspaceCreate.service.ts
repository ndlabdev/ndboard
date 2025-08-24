// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Third Party Imports
import slug from 'slug'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'
import { CACHE_KEYS } from '@src/constants/cacheKeys'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'
import { redisPlugin } from '@src/plugins/redis'

export const workspaceCreate = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .post(
        '/',
        async({ status, body, user, redis }) => {
            const { name, description } = body

            // Check for existing workspace with same name and ownerId
            const workspaceSlug = slug(name)

            const existed = await prisma.workspace.findFirst({
                where: {
                    ownerId: user.id,
                    OR: [
                        {
                            name
                        },
                        {
                            slug: workspaceSlug
                        }
                    ]
                }
            })
            if (existed) {
                return status('Conflict', {
                    code: ERROR_CODES.WORKSPACE.NAME_DUPLICATE,
                    message: 'Workspace name already exists'
                })
            }

            // Build cache key
            const cacheKey = CACHE_KEYS.WORKSPACE_LIST(user.id)

            try {
                const workspace = await prisma.workspace.create({
                    data: {
                        name,
                        slug: workspaceSlug,
                        description,
                        ownerId: user.id,
                        members: {
                            create: [{
                                userId: user.id,
                                role: WORKSPACE_ROLES.OWNER
                            }]
                        }
                    },
                    include: {
                        members: true
                    }
                })

                // ❌ Invalidate Redis cache for this user's workspace list
                const cacheKey = CACHE_KEYS.WORKSPACE_LIST(user.id)
                await redis.del(cacheKey)

                return status('Created', {
                    data: workspace
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
                }))
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Create a new workspace',
                description: 'Create a new workspace and add current user as owner'
            }
        }
    )
