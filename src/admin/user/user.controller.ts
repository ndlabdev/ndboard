// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    userRetrieve,
    userTableList,
    userUpdate,
} from './user.service'

export const userController = new Elysia({ prefix: '/users' })
    .use(userRetrieve)
    .use(userTableList)
    .use(userUpdate)
