// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authRegister,
    authSocialGithub,
    authSocialGoogle
} from './auth.service'

export const authController = new Elysia({ prefix: '/auth' })
    .use(authRegister)
    .use(authSocialGoogle)
    .use(authSocialGithub)
