// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authRegister
} from './auth.service'

export const authController = new Elysia({ prefix: '/auth' })
    .use(authRegister)
