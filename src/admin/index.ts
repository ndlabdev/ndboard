// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Controllers Imports
import { authController } from './auth/auth.controller'
import { userController } from './user/user.controller'

export const admin = new Elysia({ prefix: '/api/admin' })
    .use(authController)
    .use(userController)
