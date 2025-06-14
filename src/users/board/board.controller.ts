// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardArchive,
    boardChangeMemberRole,
    boardCreate,
    boardGetAll,
    boardGetAllList,
    boardInviteMember,
    boardKichMember,
    boardLeave,
    boardRetrieve,
    boardTransferOwner,
    boardUpdate
} from './board.service'

export const boardController = new Elysia({ prefix: '/board' })
    .use(boardArchive)
    .use(boardCreate)
    .use(boardGetAll)
    .use(boardInviteMember)
    .use(boardKichMember)
    .use(boardLeave)
    .use(boardRetrieve)
    .use(boardUpdate)
    .use(boardChangeMemberRole)
    .use(boardTransferOwner)
    .use(boardGetAllList)
