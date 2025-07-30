// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import {
    LABEL_COLOR_NAMES,
    LABEL_TONES
} from '@constants'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const boardUpdateLabel = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/labels',
        async({ body, status, user }) => {
            const { name, color, tone, id } = body

            try {
                const updated = await prisma.boardLabel.update({
                    where: {
                        id
                    },
                    data: {
                        ...(name && {
                            name
                        }),
                        ...(color && {
                            color
                        }),
                        ...(tone && {
                            tone
                        })
                    }
                })

                return status('OK', {
                    data: updated
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                id: t.String(),
                name: t.String(),
                color: t.Enum(LABEL_COLOR_NAMES),
                tone: t.Enum(LABEL_TONES),
                boardId: t.String()
            }),
            detail: {
                tags: ['Label'],
                summary: 'Update board label',
                description: 'Update an existing label in the board. User must be a workspace member. Label name must be unique within the board.'
            }
        }
    )
