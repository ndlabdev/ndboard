// ** Elysia Imports
import { JWTPayloadSpec } from '@elysiajs/jwt'
import {
    Static,
    t
} from 'elysia'

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

export const refreshTokenType = t.Object({
    refreshToken: t.String({ minLength: 1 })
})

// ** Types
export type IAuthLoginDTO = Static<typeof loginType>

export type IAuthJwt = {
    readonly sign: (
        morePayload: {
            sub: string
        } & JWTPayloadSpec
    ) => Promise<string>
    readonly verify: (jwt?: string) => Promise<
        | false
        | ({
            sub: string
        } & JWTPayloadSpec)
    >
}
