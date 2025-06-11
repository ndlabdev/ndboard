// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authLogin,
    authLogout,
    authRefreshToken
} from './auth.service'

export const authController = new Elysia({ prefix: '/auth' })
    .use(authLogin)
    .use(authRefreshToken)
    .use(authLogout)
