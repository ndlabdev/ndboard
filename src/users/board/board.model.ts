// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    boardCreateType,
    boardSearchType
} from './board.type'

export const boardModels = new Elysia().model({
    boardCreate: boardCreateType,
    boardSearch: boardSearchType
})
