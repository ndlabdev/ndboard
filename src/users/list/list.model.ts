// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    listCreateType,
    listUpdateType
} from './list.type'

export const listModels = new Elysia().model({
    listCreate: listCreateType,
    listUpdate: listUpdateType
})
