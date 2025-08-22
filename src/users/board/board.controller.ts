// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    boardArchive,
    boardCreate,
    boardCreateLabel,
    boardCustomFieldCreate,
    boardCustomFieldList,
    boardDelete,
    boardDetail,
    boardFavorite,
    boardGetBoardMember,
    boardInviteMember,
    boardList,
    boardRemoveMember,
    boardRestore,
    boardTransferOwner,
    boardUnfavorite,
    boardUpdate,
    boardUpdateLabel
} from './board.service'

export const boardController = new Elysia({
    prefix: '/boards'
})
    .use(boardCreate)
    .use(boardList)
    .use(boardDetail)
    .use(boardUpdate)
    .use(boardDelete)
    .use(boardArchive)
    .use(boardRestore)
    .use(boardTransferOwner)
    .use(boardInviteMember)
    .use(boardRemoveMember)
    .use(boardGetBoardMember)
    .use(boardFavorite)
    .use(boardUnfavorite)
    .use(boardCreateLabel)
    .use(boardUpdateLabel)
    .use(boardCustomFieldCreate)
    .use(boardCustomFieldList)
