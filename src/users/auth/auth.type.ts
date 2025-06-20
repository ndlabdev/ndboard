// ** Elysia Imports
import { t } from 'elysia'

// ** Types Definition
export const authLoginType = t.Object({
    email: t.String({
        minLength: 1,
        format: 'email'
    }),
    password: t.String({
        minLength: 6,
        maxLength: 20
    })
})

export const authRegisterType = t.Object({
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

export const authRefreshTokenType = t.Object({
    refreshToken: t.String({ minLength: 1 })
})

export const authLogoutType = t.Object({
    refreshToken: t.String({ minLength: 1 })
})
