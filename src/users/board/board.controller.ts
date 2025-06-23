// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardCreate,
    boardDelete,
    boardDetail,
    boardList,
    boardUpdate,
} from './board.service'

export const boardController = new Elysia({ prefix: '/boards' })
    .use(boardCreate)
    .use(boardList)
    .use(boardDetail)
    .use(boardUpdate)
    .use(boardDelete)
