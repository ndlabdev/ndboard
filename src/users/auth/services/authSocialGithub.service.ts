// ** Elysia Imports
import { Elysia } from 'elysia';
import { oauth2 } from 'elysia-oauth2';

// ** NodeJS Imports
import crypto from 'crypto';

// ** Prisma Imports
import prisma from '@db';
import { AuthProvider, UserRole } from '@prisma/client';

// ** Constants Imports
import { JWT } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Plugins Imports
import { jwtUserPlugin } from '@src/users/plugins/jwt';

// ** Helpers Imports
import { generateUsername } from '@helpers/utils';

export const authSocialGithub = new Elysia()
    .use(jwtUserPlugin)
    .use(
        oauth2({
            GitHub: [
                Bun.env.GITHUB_CLIENT_ID!,
                Bun.env.GITHUB_CLIENT_SECRET!,
                Bun.env.GITHUB_CALLBACK_URL!,
            ],
        })
    )
    .get(
        '/github',
        async ({ oauth2 }) => {
            const url = oauth2.createURL('GitHub', ['user:email']);
            url.searchParams.set('access_type', 'offline');

            return url.href
        }
    )
    .get('/github/callback', async ({ oauth2, jwtAccessToken, status, cookie, server, request }) => {
        const tokens = await oauth2.authorize('GitHub');

        const oauth2AccessToken = tokens.accessToken();

        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${oauth2AccessToken}`
            }
        });

        if (!response.ok) {
            return status('Bad Gateway', { error: 'Failed to fetch user info from Github' })
        }

        const profile = await response.json();

        let email = profile.email;

        if (!email) {
            const emailsRes = await fetch('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${oauth2AccessToken}` }
            });

            const emails = await emailsRes.json();
            const primary = emails.find((e: any) => e.primary && e.verified);
            email = primary?.email;
        }

        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { provider: AuthProvider.GITHUB, providerId: profile.id },
                    { email: profile.email }
                ]
            }
        })

        if (!user) {
            const username = await generateUsername(profile.name, profile.email)

            user = await prisma.user.create({
                data: {
                    email: profile.email,
                    name: profile.name || profile.email,
                    username,
                    avatar: profile.picture,
                    provider: AuthProvider.GITHUB,
                    providerId: profile.id,
                    isVerified: true,
                    role: UserRole.USER
                }
            })
        }

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
                    avatar: user.avatar,
                    role: user.role,
                    provider: user.provider
                }
            }
        })
    })