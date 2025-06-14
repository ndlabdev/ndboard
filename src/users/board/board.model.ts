// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    boardCreateType,
    boardInviteMemberType,
    boardSearchType,
    boardUpdateType
} from './board.type'

export const boardModels = new Elysia().model({
    boardCreate: boardCreateType,
    boardSearch: boardSearchType,
    boardUpdate: boardUpdateType,
    boardInviteMember: boardInviteMemberType
})
