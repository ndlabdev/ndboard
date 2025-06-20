// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const authMe = new Elysia()
    .use(authUserPlugin)
    .get(
        '/me',
        async ({ status, user }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const profile = await prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    username: true,
                    avatar: true,
                    provider: true,
                    role: true,
                    isVerified: true,
                    createdAt: true,
                    updatedAt: true
                }
            })

            if (!profile) {
                return status('Not Found', {
                    code: ERROR_CODES.ACCOUNT_INVALID,
                    message: 'Account does not exist or has been locked'
                })
            }

            return status('OK', {
                data: profile
            })
        },
        {
            detail: {
                tags: ['Auth'],
                summary: 'Get Current User Profile',
                description: 'Retrieve information of the currently authenticated user based on the provided JWT access token.'
            }
        }
    )
