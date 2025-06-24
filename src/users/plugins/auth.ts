// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Prisma Imports
import prismaClient from '@db'

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

const authUserPlugin = (app: Elysia) =>
    app
        .use(jwtUserPlugin)
        .derive(async ({ headers, status, jwtAccessToken }) => {
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

            if (!jwtPayload || !jwtPayload || !jwtPayload.userId) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'Invalid JWT payload'
                })
            }

            const user = await prismaClient.user.findUnique({
                where: { id: jwtPayload.userId },
                include: { role: true }
            })

            if (!user || !user.isActive || user.isBanned) {
                return status('Unauthorized', {
                    code: ERROR_CODES.ACCOUNT_INVALID,
                    message: 'Account does not exist or has been locked'
                })
            }

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    avatarUrl: user.avatarUrl,
                    isVerified: user.isVerified,
                    isActive: user.isActive,
                    role: user.role?.name,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            }
        })

export { authUserPlugin }
