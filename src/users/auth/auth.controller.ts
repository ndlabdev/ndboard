// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authMe,
    authRegister,
    authSocialGithub,
    authSocialGoogle
} from './auth.service'

export const authController = new Elysia({ prefix: '/auth' })
    .use(authMe)
    .use(authRegister)
    .use(authSocialGoogle)
    .use(authSocialGithub)
