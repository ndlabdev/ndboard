// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authLogin
} from './auth.service'

export const authController = new Elysia({ prefix: '/auth' })
    .use(authLogin)
