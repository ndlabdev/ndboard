// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    workspaceCreateType
} from './workspace.type'

export const workspaceModels = new Elysia().model({
    workspaceCreate: workspaceCreateType,
})
