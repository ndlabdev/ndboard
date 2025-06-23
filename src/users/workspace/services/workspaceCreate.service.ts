// ** Elysia Imports
import { Elysia, t } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const workspaceCreate = new Elysia()
    .use(authUserPlugin)
    .post(
        '/',
        async ({ status, body, user }) => {
            const { name, description } = body;

            // Check for existing workspace with same name and ownerId
            const existed = await prisma.workspace.findFirst({
                where: {
                    name,
                    ownerId: user.id
                }
            })
            if (existed) {
                return status('Conflict', {
                    code: ERROR_CODES.WORKSPACE.NAME_DUPLICATE,
                    message: 'Workspace name already exists'
                })
            }

            try {
                const workspace = await prisma.workspace.create({
                    data: {
                        name,
                        description,
                        ownerId: user.id,
                        members: {
                            create: [{
                                userId: user.id,
                                role: WORKSPACE_ROLES.OWNER,
                            }]
                        }
                    },
                    include: { members: true }
                })

                return status('Created', {
                    data: workspace
                })
            } catch (error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                name: t.String({ minLength: 1, maxLength: 100 }),
                description: t.Optional(t.String({ maxLength: 255 }))
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Create a new workspace',
                description: 'Create a new workspace and add current user as owner'
            }
        },
    )
