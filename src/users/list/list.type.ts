// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const listCreateType = t.Object({
    boardId: t.String({ minLength: 1 }),
    name: t.String({ minLength: 1, maxLength: 100 }),
    position: t.Optional(t.Integer({ minimum: 0 }))
})
