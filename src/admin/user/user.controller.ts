// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    userBan,
    userRetrieve,
    userTableList,
    userUpdate
} from './user.service'

export const userController = new Elysia({ prefix: '/users' })
    .use(userBan)
    .use(userRetrieve)
    .use(userTableList)
    .use(userUpdate)
