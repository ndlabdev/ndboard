// ** Elysia Imports
import { t } from 'elysia'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

// ** Types Definition
export const workspaceCreateType = t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 255 }))
})

export const workspaceSearchType = t.Object({
    ...paginationType,
})
