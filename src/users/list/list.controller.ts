// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    listArchive,
    listCopy,
    listCreate,
    listDelete,
    listGetByBoard,
    listReorder,
    listRestore,
    listUpdate
} from './list.service'

export const listController = new Elysia({
    prefix: '/lists'
})
    .use(listCreate)
    .use(listGetByBoard)
    .use(listUpdate)
    .use(listDelete)
    .use(listArchive)
    .use(listRestore)
    .use(listReorder)
    .use(listCopy)
