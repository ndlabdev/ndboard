// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    listArchive,
    listCreate,
    listDelete,
    listGetByBoard,
    listUpdate,
} from './list.service'

export const listController = new Elysia({ prefix: '/lists' })
    .use(listCreate)
    .use(listGetByBoard)
    .use(listUpdate)
    .use(listDelete)
    .use(listArchive)