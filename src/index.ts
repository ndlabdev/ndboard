// ** Elysia Imports
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'

// ** Router Imports
import { admin } from './admin'
import { users } from './users'

const app = new Elysia({ normalize: true })
    .use(swagger())
    .use(
        cors({
            credentials: true,
            origin: [Bun.env.USER_URL!],
            allowedHeaders: ['Content-Type', 'Authorization']
        })
    )
    .use(admin)
    .use(users)
    .get('/', () => 'ndboard - A modern, scalable, and type-safe backend API for Task Manager – powered by ElysiaJS (Bun) and MongoDB.')
    .listen(Bun.env.PORT || 3333)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
