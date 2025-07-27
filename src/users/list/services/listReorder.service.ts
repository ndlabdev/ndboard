// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Queue Imports
import { listReorderQueue } from '../queues/listReorder.queue'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const listReorder = new Elysia()
    .use(authUserPlugin)
    .patch(
        '/reorder',
        async({ status, body, user }) => {
            const { boardId, lists } = body
            const userId = user.id

            await listReorderQueue.add(
                'reorder-board',
                {
                    boardId, lists, userId
                },
                {
                    jobId: `reorder:${boardId}:${Date.now()}`,
                    removeOnComplete: 50,
                    removeOnFail: 20
                }
            )

            return status('OK', {
                data: true,
                message: 'List reorder successfully!'
            })
        },
        {
            body: t.Object({
                boardId: t.String(),
                lists: t.Array(
                    t.Object({
                        id: t.String(),
                        order: t.Integer()
                    }),
                    {
                        minItems: 2
                    }
                )
            }),
            detail: {
                tags: ['List'],
                summary: 'Reorder lists in a board',
                description: 'Batch reorder lists by changing their order field. User must be a member of the board’s workspace. All list ids must belong to the board and orders must be unique.'
            }
        }
    )
