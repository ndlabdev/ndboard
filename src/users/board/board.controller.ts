// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardCreate,
} from './board.service'

export const boardController = new Elysia({ prefix: '/boards' })
    .use(boardCreate)
