// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceDelete = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:workspaceId',
        async({ status, params, user }) => {
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
                const deleted = await prisma.workspace.delete({
                    where: {
                        id: workspaceId
                    }
                })

                return status('OK', {
                    data: deleted
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
