// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Models Imports
import { workspaceModels } from '../workspace.model';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const workspaceUpdate = new Elysia()
    .use(authUserPlugin)
    .use(workspaceModels)
    .patch(
        '/:workspaceId',
        async ({ status, params, body, user }) => {
            const { name, description } = body;
            const workspaceId = params.workspaceId
            const userId = user.id

            // Find the workspace and check if user is owner
            const workspace = await prisma.workspace.findUnique({
                where: { id: workspaceId }
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
            if (name && name !== workspace.name) {
                const existed = await prisma.workspace.findFirst({
                    where: {
                        name,
                        ownerId: userId,
                        NOT: { id: workspaceId }
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
                    where: { id: workspaceId },
                    data: {
                        name,
                        description
                    },
                })

                return status('OK', {
                    data: updated
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: 'workspaceUpdate',
            detail: {
                tags: ['Workspace'],
                summary: 'Update workspace info',
                description: 'Only workspace owner can update name, description'
            }
        },
    )
