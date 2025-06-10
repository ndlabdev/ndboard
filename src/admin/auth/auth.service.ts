// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Models Imports
import { AuthModels } from './auth.model'

export const authLogin = new Elysia()
    .use(AuthModels)
    .post(
        '/login',
        async ({ }) => {

        },
        {
            body: 'login'
        }
    )
