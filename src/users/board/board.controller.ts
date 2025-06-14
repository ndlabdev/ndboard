// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardArchive,
    boardCreate,
    boardGetAll,
    boardInviteMember,
    boardLeave,
    boardRetrieve,
    boardUpdate
} from './board.service'

export const boardController = new Elysia({ prefix: '/board' })
    .use(boardArchive)
    .use(boardCreate)
    .use(boardGetAll)
    .use(boardInviteMember)
    .use(boardLeave)
    .use(boardRetrieve)
    .use(boardUpdate)
