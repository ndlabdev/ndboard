// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    listCreate,
    listDelete,
    listReorder,
    listUnarchive,
    listUpdate
} from './list.service'

export const listController = new Elysia({ prefix: '/list' })
    .use(listCreate)
    .use(listUpdate)
    .use(listDelete)
    .use(listUnarchive)
    .use(listReorder)
