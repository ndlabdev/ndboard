// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    authLogin,
    authLogout,
    authMe,
    authRefreshToken,
    authRegister,
    authResendVerifyEmail,
    authSocialGithub,
    authSocialGoogle,
    authVerifyEmail
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
    .use(authVerifyEmail)
    .use(authResendVerifyEmail)
