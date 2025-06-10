// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Models Imports
import { AuthModels } from './auth.model'

export const authSignIn = new Elysia()
    .use(AuthModels)
    .post(
        '/sign-in',
        async ({ }) => {

        },
        {
            body: 'signIn'
        }
    )
