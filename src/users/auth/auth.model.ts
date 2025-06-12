// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import {
    loginType,
    logoutType,
    refreshTokenType,
    registerType
} from './auth.type'

export const authModels = new Elysia().model({
    login: loginType,
    refreshToken: refreshTokenType,
    logout: logoutType,
    register: registerType
})
