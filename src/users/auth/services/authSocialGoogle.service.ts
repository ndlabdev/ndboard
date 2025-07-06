// ** Elysia Imports
import { Elysia } from 'elysia'
import { oauth2 } from 'elysia-oauth2'

// ** NodeJS Imports
import crypto from 'crypto'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import {
    AUDIT_ACTION, JWT, ROLE
} from '@constants'
import { PROVIDER } from '@constants/auth'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt'

// ** Helpers Imports
import { generateUsername } from '@helpers/utils'

export const authSocialGoogle = new Elysia()
    .use(jwtUserPlugin)
    .use(
        oauth2({
            Google: [
                Bun.env.GOOGLE_CLIENT_ID!, Bun.env.GOOGLE_CLIENT_SECRET!, Bun.env.GOOGLE_CALLBACK_URL!
            ]
        })
    )
    .get(
        '/google',
        async({ oauth2, status }) => {
            const url = oauth2.createURL('Google', ['email', 'profile'])
            url.searchParams.set('access_type', 'offline')

            return status('OK', {
                data: {
                    url: url.href
                }
            })
        },
        {
            detail: {
                tags: ['Auth', 'OAuth', 'Google'],
                summary: 'Get Google OAuth2 Authorization URL',
                description: 'Generate and return the Google OAuth2 authorization URL for user to initiate the OAuth login/registration flow. Client should redirect user to this URL.'
            }
        }
    )
    .get('/google/callback', async({ oauth2, jwtAccessToken, status, cookie, server, request, headers }) => {
        // Get access token from Google
        const now = new Date()
        const tokens = await oauth2.authorize('Google')
        const oauth2AccessToken = tokens.accessToken()

        // Get user info from Google
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${oauth2AccessToken}`
            }
        })

        if (!response.ok) {
            return status('Bad Gateway', {
                code: ERROR_CODES.GENERAL.FORBIDDEN,
                message: 'Failed to fetch user info from Google'
            })
        }

        const profile = await response.json()

        // Validate minimal required info
        if (!profile.email || !profile.id) {
            return status('Unauthorized', {
                code: ERROR_CODES.AUTH.ACCOUNT_INVALID,
                message: 'Google account missing email or id'
            })
        }

        // Check if user provider already exists
        const userProvider = await prisma.userProvider.findUnique({
            where: {
                provider_providerId: {
                    provider: PROVIDER.GOOGLE,
                    providerId: profile.id
                }
            },
            include: {
                user: {
                    include: {
                        role: true
                    }
                }
            }
        })

        let user = userProvider?.user || null

        // If not exist, check duplicate email with local user
        if (!user) {
            const existedUser = await prisma.user.findUnique({
                where: {
                    email: profile.email
                },
                include: {
                    role: true
                }
            })
            if (existedUser) {
                return status('Conflict', {
                    code: ERROR_CODES.AUTH.EMAIL_EXISTS,
                    message: 'Email already exists in system, please login with email/password'
                })
            }

            // Create new user and userProvider
            const defaultRole = await prisma.role.findFirst({
                where: {
                    name: ROLE.DEFAULT
                }
            })
            if (!defaultRole) {
                return status('Not Found', {
                    code: ERROR_CODES.USER.ROLE_NOT_FOUND,
                    message: 'Default role not found in system'
                })
            }

            // Generate a unique username based on the name and email
            const username = await generateUsername(profile.name, profile.email)

            user = await prisma.user.create({
                data: {
                    email: profile.email,
                    name: profile.name,
                    avatarUrl: profile.picture,
                    isVerified: true,
                    username,
                    roleId: defaultRole.id,
                    providers: {
                        create: [{
                            provider: PROVIDER.GOOGLE,
                            providerId: profile.id,
                            email: profile.email,
                            name: profile.name,
                            avatarUrl: profile.picture
                        }]
                    }
                },
                include: {
                    role: true
                }
            })
        } else {
            await prisma.userProvider.update({
                where: {
                    id: userProvider!.id
                },
                data: {
                    email: profile.email,
                    name: profile.name,
                    avatarUrl: profile.picture
                }
            })
        }

        // Handle user not found, or inactive, or banned, or locked
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

        // Generate tokens
        const accessToken = await jwtAccessToken.sign({
            userId: user.id,
            role: user.role.name
        })
        const refreshToken = crypto.randomBytes(64).toString('hex')
        const expiresAt = new Date(now.getTime() + JWT.EXPIRE_AT * 1000)

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
                description: 'User logged in with Google',
                ipAddress: server?.requestIP(request)?.address,
                userAgent: headers['user-agent'] || ''
            }
        })

        // Reset failed login attempts, clear lock
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                failedLoginAttempts: 0,
                loginLockedUntil: null,
                lastLoginAt: new Date()
            }
        })

        cookie.token.set({
            value: accessToken,
            maxAge: JWT.ACCESS_TOKEN_EXP,
            secure: Bun.env.NODE_ENV === 'production',
            httpOnly: Bun.env.NODE_ENV === 'production',
            sameSite: Bun.env.NODE_ENV === 'production' ? 'none' : 'lax'
        })

        cookie.refreshToken.set({
            value: refreshToken,
            maxAge: JWT.EXPIRE_AT,
            secure: Bun.env.NODE_ENV === 'production',
            httpOnly: Bun.env.NODE_ENV === 'production',
            sameSite: Bun.env.NODE_ENV === 'production' ? 'none' : 'lax'
        })

        return status('OK', {
            data: {
                token: accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                    isVerified: user.isVerified,
                    role: user.role,
                    createdAt: user.createdAt
                }
            }
        })
    },
    {
        detail: {
            tags: ['Auth', 'OAuth', 'Google'],
            summary: 'Google OAuth2 Callback',
            description: 'Handle Google OAuth2 redirect. Exchange code for access token, fetch user\'s Google profile, register or login user, and return JWT access token plus user profile.'
        }
    })
