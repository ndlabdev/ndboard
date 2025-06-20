// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    authLoginType,
    authLogoutType,
    authRefreshTokenType,
    authRegisterType,
} from './auth.type'

export const authModels = new Elysia().model({
    authLogin: authLoginType,
    authRefreshToken: authRefreshTokenType,
    authLogout: authLogoutType,
    authRegister: authRegisterType
})
