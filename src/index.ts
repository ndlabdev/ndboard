// ** Elysia Imports
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'

// ** Router Imports
import { admin } from './admin'

const app = new Elysia({ prefix: '/api', normalize: true })
    .use(swagger())
    .use(
        cors({
            credentials: true,
            origin: [Bun.env.USER_URL!],
            allowedHeaders: ['Content-Type', 'Authorization']
        })
    )
    .use(admin)
    .get('/', () => 'ndboard - A modern, scalable, and type-safe backend API for Task Manager – powered by ElysiaJS (Bun) and MongoDB.')
    .listen(Bun.env.PORT || 3333)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)