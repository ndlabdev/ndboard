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

export const workspaceUpdateType = workspaceCreateType

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

export const workspaceMemberSearchType = t.Object({
    ...paginationType,
    search: t.Optional(t.String({ maxLength: 100 })),
    role: t.Optional(t.Enum(WORKSPACE_ROLES))
})

export const workspaceInviteMemberType = t.Object({
    email: t.String({
        minLength: 1,
        format: 'email'
    }),
    userId: t.Optional(t.String()),
    role: t.Optional(t.Enum(WORKSPACE_ROLES))
})

export const workspaceChangeMemberRoleType = t.Object({
    role: t.Optional(t.Enum(WORKSPACE_ROLES))
})

export const workspaceTransferOwnerType = t.Object({
    newOwnerId: t.String({ minLength: 1 })
})
