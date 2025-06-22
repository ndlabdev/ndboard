// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    workspaceCreate,
    workspaceDelete,
    workspaceDetail,
    workspaceList,
    workspaceMemberList,
    workspaceUpdate
} from './workspace.service'

export const workspaceController = new Elysia({ prefix: '/workspace' })
    .use(workspaceCreate)
    .use(workspaceDetail)
    .use(workspaceList)
    .use(workspaceUpdate)
    .use(workspaceDelete)
    .use(workspaceMemberList)
