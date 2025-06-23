// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardCreate,
    boardDetail,
    boardList,
} from './board.service'

export const boardController = new Elysia({ prefix: '/boards' })
    .use(boardCreate)
    .use(boardList)
    .use(boardDetail)
