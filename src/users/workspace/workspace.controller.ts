// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    workspaceCreate,
    workspaceDetail,
    workspaceList
} from './workspace.service'

export const workspaceController = new Elysia({ prefix: '/workspace' })
    .use(workspaceCreate)
    .use(workspaceDetail)
    .use(workspaceList)
