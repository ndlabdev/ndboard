// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const authLogout = new Elysia()
    .use(authUserPlugin)
    .post(
        '/logout',
        async ({ status, user, cookie }) => {
            if (!cookie.refreshToken) {
                return status('Bad Request', {
                    code: ERROR_CODES.AUTH.TOKEN_MISSING,
                    message: 'Refresh token is missing'
                })
            }

            // Remove the refresh token from the database (idempotent)
            await prisma.refreshToken.deleteMany({
                where: {
                    userId: user.id,
                    token: cookie.refreshToken.value
                }
            })

            cookie.refreshToken.remove()

            return status('OK', {
                message: 'Logout successfully'
            })
        },
        {
            detail: {
                tags: ['Auth'],
                summary: 'User logout',
                description: 'Logout current user and revoke refresh token.'
            }
        }
    )
