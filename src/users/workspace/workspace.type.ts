// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const workspaceCreateType = t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 255 }))
})
