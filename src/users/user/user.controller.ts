// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import { userWorkspaceList } from './user.service'

export const userController = new Elysia({
    prefix: '/user'
})
    .use(userWorkspaceList)
