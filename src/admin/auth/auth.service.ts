// ** Elysia Imports
import { Elysia } from 'elysia'

// ** NodeJS Imports
import crypto from 'crypto'

// ** Prisma Imports
import prisma from '@db'
import { UserRole } from '@prisma/client'

// ** Constants Imports
import { HASH_PASSWORD, JWT } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Models Imports
import { AuthModels } from './auth.model'

// ** Plugins Imports
import { jwtAdminPlugin } from '@src/admin/plugins/jwt'

export const authLogin = new Elysia()
    .use(AuthModels)
    .use(jwtAdminPlugin)
    .post(
        '/login',
        async ({ body, status, jwtAccessToken }) => {
            const { email, password } = body

            const user = await prisma.user.findUnique({
                where: { email }
            })

            if (!user || !user.isActive || user.isBanned) {
                return status('Unauthorized', {
                    code: ERROR_CODES.ACCOUNT_INVALID,
                    message: 'Account does not exist or has been locked'
                })
            }

            if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Only admin or superadmin can login'
                })
            }

            const passwordMatches = await Bun.password.verify(password, user.password!, HASH_PASSWORD.ALGORITHM)

            if (!passwordMatches) {
                return status('Unauthorized', {
                    code: ERROR_CODES.INVALID_PASSWORD,
                    message: 'Incorrect password'
                })
            }

            const accessToken = jwtAccessToken.sign({
                userId: user.id,
                role: user.role
            })

            const refreshToken = crypto.randomBytes(64).toString('hex')
            const expiredAt = new Date(Date.now() + JWT.EXPIRE_AT)

            await prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    token: refreshToken,
                    expiredAt,
                }
            })

            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() }
            })

            return status(200, {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                }
            })
        },
        {
            body: 'login'
        }
    )
