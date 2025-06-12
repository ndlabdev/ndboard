// ** Elysia Imports
import { t } from 'elysia'

// ** Prisma Imports
import { UserRole } from '@prisma/client'

// ** Types Imports
import { paginationType } from '@src/types/core.type'

// ** Types Definition
export const userSearchType = t.Object({
    ...paginationType,
    name: t.Optional(t.String()),
    email: t.Optional(t.String()),
    role: t.Optional(t.Enum(UserRole)),
    isActive: t.Optional(t.Boolean()),
    isBanned: t.Optional(t.Boolean())
})

export const userUpdateType = t.Object({
    name: t.Optional(t.String()),
    email: t.String({
        minLength: 1,
        format: 'email'
    })
})