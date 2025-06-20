// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authLogin,
    authMe,
    authRegister,
    authSocialGithub,
    authSocialGoogle
} from './auth.service'

export const authController = new Elysia({ prefix: '/auth' })
    .use(authLogin)
    .use(authMe)
    .use(authRegister)
    .use(authSocialGoogle)
    .use(authSocialGithub)
