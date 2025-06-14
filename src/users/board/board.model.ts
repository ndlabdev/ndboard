// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    boardChangeMemberRoleType,
    boardCreateType,
    boardInviteMemberType,
    boardSearchType,
    boardTransferOwnerType,
    boardUpdateType
} from './board.type'

export const boardModels = new Elysia().model({
    boardCreate: boardCreateType,
    boardSearch: boardSearchType,
    boardUpdate: boardUpdateType,
    boardInviteMember: boardInviteMemberType,
    boardChangeMemberRole: boardChangeMemberRoleType,
    boardTransferOwner: boardTransferOwnerType
})
