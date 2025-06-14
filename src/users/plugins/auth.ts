// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prismaClient from '@db'

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

const authUserPlugin = (app: Elysia) =>
    app.use(jwtUserPlugin).derive(async ({ jwtAccessToken, status, path, headers }) => {
        const IGNORED_PATHS = [
            '/api/user/auth/login',
            '/api/user/auth/refresh'
        ]

        if (IGNORED_PATHS.includes(path)) return {}

        const authorization = headers['authorization']

        if (!authorization) {
            return status('Unauthorized', {
                code: ERROR_CODES.UNAUTHORIZED,
                message: 'Missing Authorization header'
            })
        }

        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null

        if (!token) {
            return status('Unauthorized', {
                code: ERROR_CODES.UNAUTHORIZED,
                message: 'Invalid Bearer token'
            })
        }

        const jwtPayload = await jwtAccessToken.verify(token)

        if (!jwtPayload || !jwtPayload || !jwtPayload.sub) {
            return status('Unauthorized', {
                code: ERROR_CODES.UNAUTHORIZED,
                message: 'Invalid JWT payload'
            })
        }

        const user = await prismaClient.user.findFirst({
            where: { id: jwtPayload.sub },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                isBanned: true
            }
        })

        if (!user || !user.isActive || user.isBanned) {
            return status('Unauthorized', {
                code: ERROR_CODES.ACCOUNT_INVALID,
                message: 'Account does not exist or has been locked'
            })
        }

        return { user }
    })

export { authUserPlugin }
