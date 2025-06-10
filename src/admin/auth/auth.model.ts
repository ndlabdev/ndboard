// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import { loginType } from './auth.type'

export const AuthModels = new Elysia().model({
    login: loginType
})