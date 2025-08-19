// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

export const authVerifyEmail = new Elysia()
    .get(
        '/verify-email',
        async({ query, status }) => {
            const { token } = query
            const now = new Date()

            // Find security log
            const record = await prisma.userSecurityLog.findUnique({
                where: {
                    token
                }
            })

            if (!record) {
                return status('Bad Request', {
                    code: ERROR_CODES.AUTH.TOKEN_INVALID,
                    message: 'Invalid or missing token'
                })
            }

            if (record.isUsed) {
                return status('Bad Request', {
                    code: ERROR_CODES.AUTH.TOKEN_ALREADY_USED,
                    message: 'Verification link has already been used'
                })
            }

            if (record.expiresAt < now) {
                return status('Bad Request', {
                    code: ERROR_CODES.AUTH.TOKEN_EXPIRED,
                    message: 'Verification link has expired'
                })
            }

            // Verify user and mark token used
            await prisma.$transaction([
                prisma.user.update({
                    where: {
                        id: record.userId
                    },
                    data: {
                        isVerified: true
                    }
                }),
                prisma.userSecurityLog.update({
                    where: {
                        id: record.id
                    },
                    data: {
                        isUsed: true
                    }
                })
            ])

            return status('OK', {
                data: {
                    userId: record.userId
                },
                meta: {
                    message: 'Email verified successfully. You can now log in.'
                }
            })
        },
        {
            query: t.Object({
                token: t.String()
            }),
            detail: {
                tags: ['Auth'],
                summary: 'Verify user email',
                description: 'Activate account by verifying email with token'
            }
        }
    )
