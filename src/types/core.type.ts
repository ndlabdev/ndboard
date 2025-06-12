// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const paginationType = {
    page: t.Optional(t.String()),
    pageSize: t.Optional(t.String()),
}
