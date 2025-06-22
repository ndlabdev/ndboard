// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    workspaceCreate
} from './workspace.service'

export const workspaceController = new Elysia({ prefix: '/workspace' })
    .use(workspaceCreate)
