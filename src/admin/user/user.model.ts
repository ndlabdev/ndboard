// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    userSearchType,
    userUpdateType
} from './user.type'

export const userModels = new Elysia().model({
    userSearch: userSearchType,
    userUpdate: userUpdateType
})
