// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardCreate,
    boardGetAll
} from './board.service'

export const boardController = new Elysia({ prefix: '/board' })
    .use(boardCreate)
    .use(boardGetAll)
