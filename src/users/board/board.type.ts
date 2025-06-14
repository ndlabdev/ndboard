// ** Elysia Imports
import { t } from 'elysia'

// ** Prisma Imports
import { BoardVisibility, MemberRole } from '@prisma/client'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

// ** Types Definition
export const boardCreateType = t.Object({
    name: t.String({ minLength: 1, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 200 })),
    visibility: t.Optional(t.Enum(BoardVisibility))
})

export const boardSearchType = t.Object({
    ...paginationType,
    name: t.Optional(t.String()),
    role: t.Optional(t.Enum(MemberRole)),
    visibility: t.Optional(t.Enum(BoardVisibility)),
    archived: t.Optional(t.String()),
    sort: t.Optional(t.String())
})

export const boardUpdateType = t.Object({
    ...boardCreateType
})

export const boardInviteMemberType = t.Object({
    userId: t.String(),
    role: t.Enum(MemberRole)
})
