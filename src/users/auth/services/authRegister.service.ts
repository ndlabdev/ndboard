// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import {
    AUDIT_ACTION, HASH_PASSWORD, ROLE
} from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Helpers Imports
import { generateUsername } from '@helpers/utils'

// ** Email Services
import { sendVerifyEmail } from '../emails/email.service'

export const authRegister = new Elysia()
    .post(
        '/register',
        async({ body, status }) => {
            const { email, name, password } = body

            // Check if the email or username is already in use
            const existingUser = await prisma.user.findUnique({
                where: {
                    email
                }
            })
            if (existingUser) {
                return status('Conflict', {
                    code: ERROR_CODES.AUTH.EMAIL_EXISTS,
                    message: 'This email is already in use'
                })
            }

            // Generate a unique username based on the name and email
            const username = await generateUsername(name, email)

            // Hash the password before saving to database
            const hashedPassword = await Bun.password.hash(password, HASH_PASSWORD.ALGORITHM)

            // Retrieve the default user role from database
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

            // Create the user in database
            const user = await prisma.user.create({
                data: {
                    email,
                    username,
                    name,
                    password: hashedPassword,
                    roleId: defaultRole.id
                },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    name: true,
                    role: true,
                    createdAt: true
                }
            })

            // Log the registration action in AuditLog
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: AUDIT_ACTION.REGISTER,
                    description: 'User registered an account'
                }
            })

            // Create email verification token
            const verifyToken = Bun.randomUUIDv7()
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
            await prisma.userSecurityLog.create({
                data: {
                    userId: user.id,
                    action: 'verify_email',
                    token: verifyToken,
                    expiresAt
                }
            })

            // Send verification email
            try {
                await sendVerifyEmail(user.email, user.name, verifyToken)
            } catch(err) {
                console.error('Send email failed:', err)
            }

            return status('OK', {
                data: user,
                meta: {
                    message: 'Account created successfully. Please check your email to verify your account.'
                }
            })
        },
        {
            body: t.Object({
                name: t.String({
                    minLength: 2
                }),
                email: t.String({
                    minLength: 1,
                    format: 'email'
                }),
                password: t.String({
                    minLength: 6,
                    maxLength: 20
                })
            }),
            detail: {
                tags: ['Auth'],
                summary: 'Register new user',
                description:
                    'Register a new user account using email and password. An email verification will be sent.'
            }
        }
    )
