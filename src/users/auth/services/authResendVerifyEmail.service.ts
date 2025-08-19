// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes'

// ** Email Services
import { sendVerifyEmail } from '../emails/email.service'

export const authResendVerifyEmail = new Elysia()
    .post(
        '/resend-verify-email',
        async({ body, status }) => {
            const { email } = body
            const now = new Date()

            // Find user
            const user = await prisma.user.findUnique({
                where: {
                    email
                }
            })

            if (!user) {
                return status('Not Found', {
                    code: ERROR_CODES.AUTH.ACCOUNT_INVALID,
                    message: 'Account does not exist'
                })
            }

            if (user.isVerified) {
                return status('Bad Request', {
                    code: ERROR_CODES.AUTH.ALREADY_VERIFIED,
                    message: 'Email has already been verified'
                })
            }

            if (!user.isActive) {
                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.ACCOUNT_LOCKED,
                    message: 'Account has been deactivated'
                })
            }

            if (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > now)) {
                return status('Unauthorized', {
                    code: ERROR_CODES.AUTH.ACCOUNT_LOCKED,
                    message: user.banReason || 'Account has been banned'
                })
            }

            // Create new verify token
            const verifyToken = Bun.randomUUIDv7()
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

            await prisma.userSecurityLog.create({
                data: {
                    userId: user.id,
                    action: 'verify_email',
                    token: verifyToken,
                    expiresAt
                }
            })

            // Send email
            try {
                await sendVerifyEmail(user.email, user.name, verifyToken)
            } catch(err) {
                console.error('Send verify email failed:', err)
                return status('Internal Server Error', {
                    code: ERROR_CODES.SYSTEM.MAIL_FAILED,
                    message: 'Failed to send verification email'
                })
            }

            return status('OK', {
                data: {
                    email: user.email
                },
                meta: {
                    message: 'Verification email has been resent. Please check your inbox.'
                }
            })
        },
        {
            body: t.Object({
                email: t.String({
                    format: 'email'
                })
            }),
            detail: {
                tags: ['Auth'],
                summary: 'Resend verification email',
                description: 'Send a new verification email if the user has not verified yet'
            }
        }
    )
