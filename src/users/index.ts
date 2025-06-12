// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Controllers Imports
import { authController } from './auth/auth.controller'

export const users = new Elysia({ prefix: '/api/users' })
    .use(authController)
