// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'
import { CACHE_KEYS } from '@src/constants/cacheKeys'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'
import { redisPlugin } from '@src/plugins/redis'

export const workspaceDelete = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .delete(
        '/:workspaceId',
        async({ status, params, user, redis }) => {
            const workspaceId = params.workspaceId
            const userId = user.id

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
                    message: 'Only owner can delete workspace'
                })
            }

            try {
                await prisma.$transaction([
                    prisma.workspace.delete({
                        where: {
                            id: workspaceId
                        }
                    }),
                    prisma.auditLog.create({
                        data: {
                            userId,
                            action: 'WORKSPACE_DELETE',
                            description: `User ${user.name} (${user.email}) deleted workspace "${workspace.name}" (${workspace.id}, slug: ${workspace.slug})`
                        }
                    })
                ])

                const boards = await prisma.board.findMany({
                    where: {
                        workspaceId
                    },
                    select: {
                        id: true
                    }
                })

                // Delete Redis
                await Promise.all([
                    redis.del(CACHE_KEYS.WORKSPACE_LIST(userId)), redis.del(CACHE_KEYS.WORKSPACE_DETAIL(userId, workspaceId)), redis.del(CACHE_KEYS.BOARD_LIST(userId, workspaceId)), ...boards.map((b) => redis.del(CACHE_KEYS.BOARD_DETAIL(userId, b.id)))
                ])

                return status('OK', {
                    data: {
                        workspaceId,
                        name: workspace.name
                    },
                    message: 'Workspace deleted successfully'
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            detail: {
                tags: ['Workspace'],
                summary: 'Delete workspace',
                description: 'Only owner can delete workspace'
            }
        }
    )
