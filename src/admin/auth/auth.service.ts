// ** Elysia Imports
import { Elysia } from 'elysia'

// ** NodeJS Imports
import crypto from 'crypto'

// ** Prisma Imports
import prisma from '@db'
// import { UserRole } from '@prisma/client'

// ** Constants Imports
import { ADMIN_ACTIONS, ADMIN_TARGET_TYPES, HASH_PASSWORD, JWT } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Models Imports
import { authModels } from './auth.model'

// ** Plugins Imports
import { jwtAdminPlugin } from '@src/admin/plugins/jwt'

export const authLogin = new Elysia()
    .use(authModels)
    .use(jwtAdminPlugin)
    .post(
        '/login',
        async ({ body, status, jwtAccessToken, cookie, server, request, headers }) => {
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
                await prisma.adminLog.create({
                    data: {
                        userId: user.id,
                        action: ADMIN_ACTIONS.LOGIN_FAIL_ROLE,
                        targetType: ADMIN_TARGET_TYPES.USER,
                        targetId: user.id,
                        detail: {
                            reason: 'User role is not admin or superadmin',
                            ip: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }
                })

                return status('Forbidden', {
                    code: ERROR_CODES.FORBIDDEN,
                    message: 'Only admin or superadmin can login'
                })
            }

            if (user.lockedUntil && user.lockedUntil > new Date()) {
                await prisma.adminLog.create({
                    data: {
                        userId: user.id,
                        action: ADMIN_ACTIONS.LOGIN_FAIL_LOCKED,
                        targetType: ADMIN_TARGET_TYPES.USER,
                        targetId: user.id,
                        detail: {
                            reason: 'Account locked until ' + user.lockedUntil.toISOString(),
                            ip: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }
                })

                return status('Forbidden', {
                    code: ERROR_CODES.ACCOUNT_LOCKED,
                    message: 'Account is temporarily locked due to too many failed login attempts'
                })
            }

            const passwordMatches = await Bun.password.verify(password, user.password!, HASH_PASSWORD.ALGORITHM)

            if (!passwordMatches) {
                let newFailCount = user.loginFailCount + 1
                let lockedUntil = null
                if (newFailCount >= 5) {
                    lockedUntil = new Date(Date.now() + 5 * 60 * 1000)
                    newFailCount = 0
                }

                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        loginFailCount: newFailCount,
                        lockedUntil
                    }
                })

                await prisma.adminLog.create({
                    data: {
                        userId: user.id,
                        action: ADMIN_ACTIONS.LOGIN_FAIL_PASSWORD,
                        targetType: ADMIN_TARGET_TYPES.USER,
                        targetId: user.id,
                        detail: {
                            reason: 'Incorrect password',
                            ip: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }
                })

                return status('Unauthorized', {
                    code: ERROR_CODES.INVALID_PASSWORD,
                    message: 'Incorrect password'
                })
            }

            const accessToken = await jwtAccessToken.sign({
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
                data: {
                    loginFailCount: 0,
                    lockedUntil: null,
                    lastLoginAt: new Date(),
                    lastActivityAt: new Date(),
                    lastActivityIP: server?.requestIP(request)?.address
                }
            })

            await prisma.adminLog.create({
                data: {
                    userId: user.id,
                    action: ADMIN_ACTIONS.LOGIN,
                    targetType: ADMIN_TARGET_TYPES.USER,
                    targetId: user.id,
                    detail: {
                        ip: server?.requestIP(request)?.address,
                        userAgent: headers['user-agent'] || ''
                    }
                }
            })

            cookie.refreshTokenAdmin.set({
                value: refreshToken,
                maxAge: JWT.EXPIRE_AT,
                secure: Bun.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'none'
            })

            return status('OK', {
                accessToken,
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

export const authRefreshToken = new Elysia()
    .use(authModels)
    .use(jwtAdminPlugin)
    .post(
        '/refresh-token',
        async ({ body, status, jwtAccessToken }) => {
            const { refreshToken } = body

            if (!refreshToken) {
                return status('Bad Request', {
                    code: ERROR_CODES.TOKEN_MISSING,
                    message: 'Missing refresh token'
                })
            }

            const tokenDoc = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            })

            if (!tokenDoc || tokenDoc.expiredAt < new Date()) {
                return status('Unauthorized', {
                    code: ERROR_CODES.TOKEN_INVALID,
                    message: 'Refresh token is invalid or expired'
                })
            }

            const user = tokenDoc.user

            if (
                !user.isActive ||
                user.isBanned ||
                (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN)
            ) {
                return status('Unauthorized', {
                    code: ERROR_CODES.ACCOUNT_INVALID,
                    message: 'User is not valid'
                })
            }

            const accessToken = jwtAccessToken.sign({
                userId: user.id,
                role: user.role
            })

            return status('OK', {
                accessToken
            })
        },
        {
            body: 'refreshToken'
        }
    )


export const authLogout = new Elysia()
    .use(authModels)
    .use(jwtAdminPlugin)
    .post(
        '/logout',
        async ({ body, status, cookie, server, request, headers }) => {
            const { refreshToken } = body

            if (!refreshToken) {
                return status('Bad Request', {
                    code: ERROR_CODES.TOKEN_MISSING,
                    message: 'Missing refresh token'
                })
            }

            const tokenDoc = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            })

            if (tokenDoc && tokenDoc.user) {
                await prisma.adminLog.create({
                    data: {
                        userId: tokenDoc.user.id,
                        action: ADMIN_ACTIONS.LOGOUT,
                        targetType: ADMIN_TARGET_TYPES.USER,
                        targetId: tokenDoc.user.id,
                        detail: {
                            ip: server?.requestIP(request)?.address,
                            userAgent: headers['user-agent'] || ''
                        }
                    }
                })
            }

            await prisma.refreshToken.deleteMany({
                where: {
                    token: refreshToken
                }
            })

            cookie.refreshTokenAdmin.remove()

            return status('OK')
        },
        {
            body: 'logout'
        }
    )
