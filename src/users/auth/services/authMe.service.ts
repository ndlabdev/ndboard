// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const authMe = new Elysia()
    .use(authUserPlugin)
    .get(
        '/me',
        ({ status, user }) => {
            return status('OK', {
                data: user
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
