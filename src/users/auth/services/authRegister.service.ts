// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { AuthProvider } from '@prisma/client';

// ** Constants Imports
import { HASH_PASSWORD } from '@constants';
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

            const exist = await prisma.user.findUnique({
                where: { email }
            })

            if (exist) {
                return status('Conflict', {
                    code: ERROR_CODES.EMAIL_EXISTS,
                    message: 'This email is already in use'
                })
            }

            const username = await generateUsername(name, email)

            const hashed = await Bun.password.hash(password, HASH_PASSWORD.ALGORITHM)

            const user = await prisma.user.create({
                data: {
                    email,
                    name,
                    username,
                    password: hashed,
                    provider: AuthProvider.LOCAL,
                    isVerified: false,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    username: true,
                    provider: true,
                    isVerified: true,
                    role: true,
                    createdAt: true
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
                summary: 'User Registration',
                description: 'Register a new user account using email and password. Returns the created user profile on success.'
            }
        }
    )
