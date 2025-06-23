// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardArchive,
    boardCreate,
    boardDelete,
    boardDetail,
    boardInviteMember,
    boardList,
    boardRestore,
    boardTransferOwner,
    boardUpdate,
} from './board.service'

export const boardController = new Elysia({ prefix: '/boards' })
    .use(boardCreate)
    .use(boardList)
    .use(boardDetail)
    .use(boardUpdate)
    .use(boardDelete)
    .use(boardArchive)
    .use(boardRestore)
    .use(boardTransferOwner)
    .use(boardInviteMember)
