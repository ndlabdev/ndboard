// ** Third Party Imports
import {
    Job,
    Queue, Worker
} from 'bullmq'

// ** Prisma Imports
import prisma from '@db'

// ** Plugins Imports
import { redisClient } from '@src/plugins/redis'

const redis = redisClient.getRawInstance()

export const listReorderQueue = new Queue('list-reorder', {
    connection: redis
})

interface JobData {
    boardId: string;
    lists: {
        id: string;
        order: number;
    }[];
    userId: string;
}

const worker = new Worker<JobData>('list-reorder', async(job) => {
    const { boardId, lists, userId } = job.data

    try {
        // Check if board exists & workspace permission
        const board = await prisma.board.findUnique({
            where: {
                id: boardId
            },
            include: {
                workspace: {
                    include: {
                        members: true
                    }
                },
                lists: true
            }
        })
        if (!board) {
            throw new Error('Board does not exist')
        }

        const isMember = board.workspace.members.some((m) => m.userId === userId)
        if (!isMember) {
            throw new Error('You are not a member of this workspace')
        }

        // Validate all list ids belong to this board
        const boardListIds = board.lists.map((l) => l.id)
        const allValid = lists.every((l) => boardListIds.includes(l.id))
        if (!allValid) {
            throw new Error('One or more lists do not belong to this board')
        }

        // Validate unique order & unique list ids
        const orderSet = new Set(lists.map((l) => l.order))
        const idSet = new Set(lists.map((l) => l.id))
        if (orderSet.size !== lists.length || idSet.size !== lists.length) {
            throw new Error('Orders or list ids are not unique')
        }

        // Batch update list orders in a transaction
        await prisma.$transaction(
            lists.map((l, idx) =>
                prisma.list.update({
                    where: {
                        id: l.id
                    },
                    data: {
                        order: idx,
                        updatedById: userId
                    }
                }))
        )

        // Log activity
        await prisma.boardActivity.create({
            data: {
                boardId: boardId,
                userId,
                action: 'reorder_list',
                detail: `Reordered lists in board "${board.name}"`
            }
        })

        return {
            ok: true
        }
    } catch(error) {
        console.error('[Reorder Worker] Failed job:', {
            jobId: job.id,
            boardId: job.data.boardId,
            userId: job.data.userId,
            error
        })
        throw error
    }
}, {
    connection: redis
})

worker.on('failed', (job: Job<JobData> | undefined, err: Error, prev) => {
    if (!job) {
        console.error('[Worker][FAILED] job is undefined', {
            err, prev
        })
        return
    }

    console.error(`[Worker][FAILED] jobId: ${job.id}`, {
        boardId: job.data.boardId,
        userId: job.data.userId,
        error: err.message,
        stack: err.stack,
        prevStatus: prev
    })
})
