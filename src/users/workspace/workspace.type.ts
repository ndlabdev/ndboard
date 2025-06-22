// ** Elysia Imports
import { t } from 'elysia';

// ** Types Imports
import { paginationType } from '@src/types/core.type';

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants';

// ** Types Definition
export const workspaceCreateType = t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 255 }))
})

export const workspaceSearchType = t.Object({
    ...paginationType,
    name: t.Optional(t.String({ maxLength: 100 })),
    role: t.Optional(t.Enum(WORKSPACE_ROLES)),
    sortBy: t.Optional(t.Union([
        t.Literal('joinedAt'),
        t.Literal('name'),
        t.Literal('createdAt')
    ], { default: 'joinedAt' })),
    order: t.Optional(t.Union([
        t.Literal('asc'),
        t.Literal('desc')
    ], { default: 'desc' }))
})
