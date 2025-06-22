// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    workspaceChangeMemberRoleType,
    workspaceCreateType,
    workspaceInviteMemberType,
    workspaceMemberSearchType,
    workspaceSearchType,
    workspaceTransferOwnerType,
    workspaceUpdateType,
} from './workspace.type'

export const workspaceModels = new Elysia().model({
    workspaceCreate: workspaceCreateType,
    workspaceSearch: workspaceSearchType,
    workspaceUpdate: workspaceUpdateType,
    workspaceMemberSearch: workspaceMemberSearchType,
    workspaceInviteMember: workspaceInviteMemberType,
    workspaceChangeMemberRole: workspaceChangeMemberRoleType,
    workspaceTransferOwner: workspaceTransferOwnerType,
})
