// ** Elysia Imports
import { jwt } from '@elysiajs/jwt'
import {
    Elysia,
    t
} from 'elysia'

// ** Constants Imports
import { JWT } from '@constants'

const jwtAdminPlugin = (app: Elysia) =>
    app
        .use(
            jwt({
                name: JWT.ACCESS_TOKEN_NAME,
                schema: t.Object({
                    userId: t.String(),
                    role: t.String()
                }),
                exp: '1h',
                secret: Bun.env.JWT_ACCESS_SECRET!
            })
        )
        .use(
            jwt({
                name: JWT.REFRESH_TOKEN_NAME,
                schema: t.Object({
                    sub: t.String(),
                    role: t.String()
                }),
                exp: '7 days',
                secret: Bun.env.JWT_REFRESH_SECRET!
            })
        )

export { jwtAdminPlugin }
