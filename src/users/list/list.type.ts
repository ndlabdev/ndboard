// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const listCreateType = t.Object({
    boardId: t.String({ minLength: 1 }),
    name: t.String({ minLength: 1, maxLength: 100 }),
    position: t.Optional(t.Integer({ minimum: 0 }))
})

export const listUpdateType = t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    position: t.Optional(t.Integer({ minimum: 0 }))
})

export const listReorderType = t.Object({
    boardId: t.String({ minLength: 1 }),
    orders: t.Array(
        t.Object({
            id: t.String({ minLength: 1 }),
            position: t.Integer({ minimum: 0 })
        }), { minItems: 1 }
    )
})
