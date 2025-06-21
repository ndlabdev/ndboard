// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';

// ** Constants Imports
import { AUDIT_ACTION, HASH_PASSWORD, ROLE } from '@constants';
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { authModels } from '../auth.model';

// ** Helpers Imports
import { generateUsername } from '@helpers/utils';

export const authRegister = new Elysia()
    .use(authModels)
    .post(
        '/register',
        async ({ body, status }) => {
            const { email, name, password } = body

            // Check if the email or username is already in use
            const existingUser = await prisma.user.findUnique({
                where: { email }
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
                where: { name: ROLE.DEFAULT }
            })
            if (!defaultRole) {
                return {
                    code: ERROR_CODES.USER.ROLE_NOT_FOUND,
                    message: 'Default role not found in system'
                }
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
                    isVerified: true,
                    role: true,
                    createdAt: true,
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

            return status('OK', {
                data: user
            })
        },
        {
            body: 'authRegister',
            detail: {
                tags: ['Auth'],
                summary: 'Register new user',
                description: 'Register a new user account using email and password'
            }
        }
    )
