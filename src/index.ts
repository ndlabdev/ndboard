// ** Elysia Imports
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api', normalize: true })
    .use(swagger())
    .use(
        cors({
            credentials: true,
            origin: [Bun.env.USER_URL!],
            allowedHeaders: ['Content-Type', 'Authorization']
        })
    )
    .get('/', () => 'Hello Elysia')
    .listen(Bun.env.PORT || 3333)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)