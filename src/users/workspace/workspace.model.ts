// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    workspaceCreateType,
    workspaceSearchType,
} from './workspace.type'

export const workspaceModels = new Elysia().model({
    workspaceCreate: workspaceCreateType,
    workspaceSearch: workspaceSearchType,
})
