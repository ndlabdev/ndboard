// ** Elysia Imports
import {
    Elysia, t
} from 'elysia'

// ** Prisma Imports
import prisma from '@db'

// ** Constants Imports
import { WORKSPACE_ROLES } from '@constants'
import { ERROR_CODES } from '@constants/errorCodes'

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth'

export const workspaceTransferOwner = new Elysia()
    .use(authUserPlugin)
    .delete(
        '/:workspaceId/transfer-owner',
        async({ status, body, params, user }) => {
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

                return status('OK', {
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
