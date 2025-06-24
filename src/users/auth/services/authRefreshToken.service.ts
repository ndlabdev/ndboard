// ** Elysia Imports
import { Elysia } from 'elysia'

// ** NodeJS Imports
import crypto from 'crypto'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { JWT } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt'

export const authRefreshToken = new Elysia()
    .use(jwtUserPlugin)
    .post(
        '/refresh-token',
        async({ status, jwtAccessToken, cookie }) => {
            // Find refresh token in database
            const tokenInDb = await prisma.refreshToken.findUnique({
                where: {
                    token: cookie.refreshToken.value
                },
                include: {
                    user: {
                        include: {
                            role: true
                        }
                    }
                }
            })

            if (
                !tokenInDb ||
                !tokenInDb.user ||
                !tokenInDb.expiresAt ||
                tokenInDb.expiresAt < new Date()
            ) {
                if (cookie?.refreshToken) {
                    cookie.refreshToken.remove()
                }

                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.TOKEN_INVALID,
                    message: 'Refresh token is invalid or expired'
                })
            }

            const user = tokenInDb.user

            if (!user.isActive || user.isBanned) {
                if (cookie?.refreshToken) {
                    cookie.refreshToken.remove()
                }

                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.TOKEN_INVALID,
                    message: 'Account has been locked or banned'
                })
            }

            // Option: Rotate refresh token (security best practice)
            const newRefreshToken = crypto.randomBytes(64).toString('hex')
            const newExpiresAt = new Date(Date.now() + JWT.EXPIRE_AT)

            await prisma.$transaction([
                prisma.refreshToken.delete({
                    where: {
                        token: cookie.refreshToken.value
                    }
                }),
                prisma.refreshToken.create({
                    data: {
                        userId: user.id,
                        token: newRefreshToken,
                        expiresAt: newExpiresAt
                    }
                })
            ])

            // Generate new access token
            const accessToken = await jwtAccessToken.sign({
                userId: user.id,
                role: user.role.name
            })

            cookie.refreshToken.set({
                value: newRefreshToken,
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
            detail: {
                tags: ['Auth'],
                summary: 'Refresh token',
                description: 'Exchange refresh token for new access token (and optionally new refresh token)'
            }
        }
    )
