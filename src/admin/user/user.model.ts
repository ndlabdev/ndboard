// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    userBanType,
    userSearchType,
    userUpdateType
} from './user.type'

export const userModels = new Elysia().model({
    userBan: userBanType,
    userSearch: userSearchType,
    userUpdate: userUpdateType
})
