// ** Elysia Imports
import { Elysia } from 'elysia';

// ** NodeJS Imports
import crypto from 'crypto';

// ** Prisma Imports
import prisma from '@db';

// ** Models Imports
import { authModels } from '../auth.model';

// ** Constants Imports
import { HASH_PASSWORD, JWT } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt';

export const authLogin = new Elysia()
    .use(authModels)
    .use(jwtUserPlugin)
    .post(
        '/login',
        async ({ body, status, jwtAccessToken, server, request }) => {
            // Find user by email
            const user = await prisma.user.findUnique({
                where: { email: body.email }
            })

            // If user not found or locked
            if (!user || !user.isActive || user.isBanned) {
                return status('Unauthorized', {
                    code: ERROR_CODES.ACCOUNT_INVALID,
                    message: 'Account does not exist or has been locked'
                })
            }

            if (user.lockedUntil && user.lockedUntil > new Date()) {
                return status('Forbidden', {
                    code: ERROR_CODES.ACCOUNT_LOCKED,
                    message: 'Account is temporarily locked due to too many failed login attempts'
                })
            }

            // Check password
            const validPassword = await Bun.password.verify(body.password, user.password!, HASH_PASSWORD.ALGORITHM)
            if (!validPassword) {
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

            return status('OK', {
                data: {
                    token: accessToken,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        username: user.username,
                        provider: user.provider,
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
                description: 'Authenticate user with email and password. Returns JWT access token and basic user profile on success.'
            }
        }
    )
