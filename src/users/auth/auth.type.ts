// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const loginType = t.Object({
    email: t.String({
        minLength: 1,
        format: 'email'
    }),
    password: t.String({
        minLength: 6,
        maxLength: 20
    })
})

export const registerType = t.Object({
    name: t.String({ minLength: 2 }),
    email: t.String({
        minLength: 1,
        format: 'email'
    }),
    password: t.String({
        minLength: 6,
        maxLength: 20
    })
})

export const refreshTokenType = t.Object({
    refreshToken: t.String({ minLength: 1 })
})

export const logoutType = t.Object({
    refreshToken: t.String({ minLength: 1 })
})
