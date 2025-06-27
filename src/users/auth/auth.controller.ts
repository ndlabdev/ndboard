// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authLogin,
    authLogout,
    authMe,
    authRefreshToken,
    authRegister,
    authSocialGithub,
    authSocialGoogle
} from './auth.service'

export const authController = new Elysia({
    prefix: '/auth'
})
    .use(authLogin)
    .use(authMe)
    .use(authRegister)
    .use(authSocialGoogle)
    .use(authSocialGithub)
    .use(authRefreshToken)
    .use(authLogout)
