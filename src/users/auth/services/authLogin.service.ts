// ** Elysia Imports
import { Elysia } from 'elysia';

// ** NodeJS Imports
import crypto from 'crypto';

// ** Prisma Imports
import prisma from '@db';

// ** Models Imports
import { authModels } from '../auth.model';

// ** Constants Imports
import { AUDIT_ACTION, HASH_PASSWORD, JWT } from '@constants';
import { AUTH_SECURITY } from '@constants/auth';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt';

export const authLogin = new Elysia()
    .use(authModels)
    .use(jwtUserPlugin)
    .post(
        '/login',
        async ({ body, status, jwtAccessToken, cookie, server, request, headers }) => {
            const { email, password } = body
            const now = new Date()

            // Find user by email
            const user = await prisma.user.findUnique({
                where: { email },
                include: {
                    role: true
                }
            })

            // Handle user not found, or inactive, or banned, or locked
            if (!user) {
                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.ACCOUNT_INVALID,
                    message: 'Invalid account or password'
                })
            }
            if (!user.isActive) {
                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.ACCOUNT_LOCKED,
                    message: 'Account has been deactivated'
                })
            }
            if (user.isBanned && (!user.banExpiresAt || (user.banExpiresAt > now))) {
                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.ACCOUNT_LOCKED,
                    message: user.banReason || 'Account has been banned'
                })
            }
            if (user.loginLockedUntil && user.loginLockedUntil > now) {
                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.ACCOUNT_LOCKED,
                    message: `Account is temporarily locked. Try again after ${user.loginLockedUntil.toISOString()}`
                })
            }

            // Compare password (should not leak timing)
            const validPassword = await Bun.password.verify(password, user.password!, HASH_PASSWORD.ALGORITHM)

            // Handle password wrong
            if (!validPassword) {
                const failedAttempts = user.failedLoginAttempts + 1
                const updateData: {
                    failedLoginAttempts?: number
                    loginLockedUntil?: Date | null
                } = { failedLoginAttempts: failedAttempts }

                // Lock account if failed too many times
                if (failedAttempts >= AUTH_SECURITY.MAX_FAILED_ATTEMPTS) {
                    updateData.loginLockedUntil = new Date(
                        now.getTime() + AUTH_SECURITY.LOCK_TIME_MINUTES * 60 * 1000
                    )
                }

                await prisma.user.update({
                    where: { id: user.id },
                    data: updateData
                })

                // Audit log
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        action: AUDIT_ACTION.LOGIN,
                        description: 'Failed login attempt',
                        ipAddress: server?.requestIP(request)?.address,
                        userAgent: headers['user-agent'] || ''
                    }
                })

                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.INVALID_PASSWORD,
                    message: 'Invalid account or password'
                })
            }

            // Reset failed login attempts, clear lock
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: 0,
                    loginLockedUntil: null,
                    lastLoginAt: new Date()
                }
            })

            // Generate tokens
            const accessToken = await jwtAccessToken.sign({
                userId: user.id,
                role: user.role.name
            })
            const refreshToken = crypto.randomBytes(64).toString('hex')
            const expiresAt = new Date(now.getTime() + JWT.EXPIRE_AT)

            await prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    token: refreshToken,
                    expiresAt
                }
            })

            // Audit log
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: AUDIT_ACTION.LOGIN,
                    description: 'User logged in',
                    ipAddress: server?.requestIP(request)?.address,
                    userAgent: headers['user-agent'] || ''
                }
            })

            cookie.refreshToken.set({
                value: refreshToken,
                maxAge: JWT.EXPIRE_AT,
                secure: Bun.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: 'none'
            })

            return status('OK', {
                data: {
                    token: accessToken,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        username: user.username,
                        isVerified: user.isVerified,
                        role: user.role,
                        createdAt: user.createdAt
                    }
                }
            })
        },
        {
            body: 'authLogin',
            detail: {
                tags: ['Auth'],
                summary: 'User Login with Email & Password',
                description: 'Authenticate user with email and password'
            }
        }
    )
