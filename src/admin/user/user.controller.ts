// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    userTableList,
} from './user.service'

export const userController = new Elysia({ prefix: '/user' })
    .use(userTableList)
