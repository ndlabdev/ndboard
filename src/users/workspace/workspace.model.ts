// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    workspaceCreateType,
    workspaceSearchType,
    workspaceUpdateType,
} from './workspace.type'

export const workspaceModels = new Elysia().model({
    workspaceCreate: workspaceCreateType,
    workspaceSearch: workspaceSearchType,
    workspaceUpdate: workspaceUpdateType,
})
