// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    listCreate,
    listUpdate
} from './list.service'

export const listController = new Elysia({ prefix: '/list' })
    .use(listCreate)
    .use(listUpdate)
