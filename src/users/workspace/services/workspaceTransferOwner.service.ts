// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'
import { CACHE_KEYS } from '@src/constants/cacheKeys'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'
import { redisPlugin } from '@src/plugins/redis'

export const workspaceTransferOwner = new Elysia()
    .use(authUserPlugin)
    .use(redisPlugin)
    .patch(
        '/:workspaceId/transfer-owner',
        async({ status, body, params, user, redis }) => {
            const { workspaceId } = params
            const { newOwnerId } = body
            const operatorId = user.id

            // Check workspace existence
            const workspace = await prisma.workspace.findUnique({
                where: {
                    id: workspaceId
                }
            })
            if (!workspace) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.NOT_FOUND,
                    message: 'Workspace does not exist'
                })
            }

            // Only owner can transfer
            if (workspace.ownerId !== operatorId) {
                return status('Forbidden', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'Only current owner can transfer ownership'
                })
            }

            // Cannot transfer to self
            if (operatorId === newOwnerId) {
                return status('Bad Request', {
                    code: ERROR_CODES.WORKSPACE.FORBIDDEN,
                    message: 'Only current owner can transfer ownership'
                })
            }

            // New owner must be member
            const newOwnerMember = await prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: newOwnerId
                    }
                },
                include: {
                    user: {
                        select: {
                            id: true, name: true
                        }
                    }
                }
            })
            if (!newOwnerMember) {
                return status('Not Found', {
                    code: ERROR_CODES.WORKSPACE.USER_NOT_FOUND,
                    message: 'New owner must be a member of this workspace'
                })
            }

            try {
                await prisma.$transaction([
                    prisma.workspace.update({
                        where: {
                            id: workspaceId
                        },
                        data: {
                            ownerId: newOwnerId
                        }
                    }),
                    prisma.workspaceMember.update({
                        where: {
                            workspaceId_userId: {
                                workspaceId, userId: operatorId
                            }
                        },
                        data: {
                            role: WORKSPACE_ROLES.ADMIN
                        }
                    }),
                    prisma.workspaceMember.update({
                        where: {
                            workspaceId_userId: {
                                workspaceId, userId: newOwnerId
                            }
                        },
                        data: {
                            role: WORKSPACE_ROLES.OWNER
                        }
                    }),
                    prisma.auditLog.create({
                        data: {
                            userId: operatorId,
                            action: 'WORKSPACE_TRANSFER_OWNER',
                            description: `Transferred ownership of workspace ${workspaceId} to user ${newOwnerId}`
                        }
                    })
                ])

                // Update cache for old owner
                const oldKey = CACHE_KEYS.WORKSPACE_LIST(operatorId)
                const cachedOld = await redis.get(oldKey)
                if (cachedOld) {
                    const parsed = JSON.parse(cachedOld)
                    parsed.data = parsed.data.map((w: any) =>
                        w.id === workspaceId
                            ? {
                                ...w,
                                ownerId: newOwnerId,
                                role: WORKSPACE_ROLES.ADMIN,
                                members: w.members.map((m: { id: string }) =>
                                    m.id === operatorId
                                        ? {
                                            ...m, role: WORKSPACE_ROLES.ADMIN
                                        }
                                        : m.id === newOwnerId
                                            ? {
                                                ...m, role: WORKSPACE_ROLES.OWNER
                                            }
                                            : m)
                            }
                            : w)
                    await redis.set(oldKey, JSON.stringify(parsed))
                }

                // Update cache for new owner
                const newKey = CACHE_KEYS.WORKSPACE_LIST(newOwnerId)
                const cachedNew = await redis.get(newKey)
                if (cachedNew) {
                    const parsed = JSON.parse(cachedNew)
                    const exists = parsed.data.find((w: { id: string }) => w.id === workspaceId)
                    if (exists) {
                        parsed.data = parsed.data.map((w: { id: string; members: { id: string }[] }) =>
                            w.id === workspaceId
                                ? {
                                    ...w,
                                    ownerId: newOwnerId,
                                    role: WORKSPACE_ROLES.OWNER,
                                    members: w.members.map((m) =>
                                        m.id === operatorId
                                            ? {
                                                ...m, role: WORKSPACE_ROLES.ADMIN
                                            }
                                            : m.id === newOwnerId
                                                ? {
                                                    ...m, role: WORKSPACE_ROLES.OWNER
                                                }
                                                : m)
                                }
                                : w)
                    } else {
                        parsed.data.push({
                            id: workspaceId,
                            ownerId: newOwnerId,
                            role: WORKSPACE_ROLES.OWNER,
                            members: [
                                {
                                    id: operatorId, role: WORKSPACE_ROLES.ADMIN
                                },
                                {
                                    id: newOwnerId, role: WORKSPACE_ROLES.OWNER
                                }
                            ]
                        })
                        parsed.meta.total += 1
                    }
                    await redis.set(newKey, JSON.stringify(parsed))
                }

                return status('OK', {
                    data: {
                        workspaceId,
                        oldOwnerId: operatorId,
                        newOwnerId,
                        newOwnerName: newOwnerMember.user?.name ?? null
                    },
                    message: 'Transfer Owner Successfully'
                })
            } catch(error) {
                return status('Internal Server Error', error)
            }
        },
        {
            body: t.Object({
                newOwnerId: t.String({
                    minLength: 1
                })
            }),
            detail: {
                tags: ['Workspace'],
                summary: 'Transfer workspace ownership',
                description: 'Only owner can transfer ownership to another member'
            }
        }
    )
