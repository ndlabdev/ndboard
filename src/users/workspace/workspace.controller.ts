// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    workspaceChangeMemberRole,
    workspaceCreate,
    workspaceDelete,
    workspaceDetail,
    workspaceInviteMember,
    workspaceList,
    workspaceMemberList,
    workspaceRemoveMember,
    workspaceTransferOwner,
    workspaceUpdate
} from './workspace.service'

export const workspaceController = new Elysia({ prefix: '/workspace' })
    .use(workspaceCreate)
    .use(workspaceDetail)
    .use(workspaceList)
    .use(workspaceUpdate)
    .use(workspaceDelete)
    .use(workspaceMemberList)
    .use(workspaceInviteMember)
    .use(workspaceRemoveMember)
    .use(workspaceChangeMemberRole)
    .use(workspaceTransferOwner)
