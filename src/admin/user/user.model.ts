// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import { userSearchType } from './user.type'

export const userModels = new Elysia().model({
    userSearch: userSearchType
})
