// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const cardCreateType = t.Object({
    title: t.String({ minLength: 1, maxLength: 255 }),
    listId: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    dueDate: t.Optional(t.String({ format: 'date-time' }))
})
