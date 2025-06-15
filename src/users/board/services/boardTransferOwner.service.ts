// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Prisma Imports
import prisma from '@db';
import { MemberRole } from '@prisma/client';

// ** Constants Imports
import { ERROR_CODES } from '@constants/errorCodes';

// ** Models Imports
import { boardModels } from '../board.model';

// ** Plugins Imports
import { authUserPlugin } from '@src/users/plugins/auth';

export const boardTransferOwner = new Elysia()
    .use(authUserPlugin)
    .use(boardModels)
    .post(
        '/:boardId/transfer-owner',
        async ({ params, body, user, status }) => {
            if (!user?.id) {
                return status('Unauthorized', {
                    code: ERROR_CODES.UNAUTHORIZED,
                    message: 'User must be authenticated'
                })
            }

            const boardId = params.boardId
            const targetUserId = body.userId

            // Get current owner
            const owner = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: user.id,
                    role: MemberRole.OWNER
                }
            })

            if (!owner) {
                return status('Forbidden', {
                    code: ERROR_CODES.TRANSFER_OWNER_NOT_ALLOWED,
                    message: 'Only the current owner can transfer ownership'
                })
            }

            // Cannot transfer to self
            if (user.id === targetUserId) {
                return status('Bad Request', {
                    code: ERROR_CODES.TRANSFER_OWNER_NOT_ALLOWED,
                    message: 'Cannot transfer ownership to yourself'
                })
            }

            // Check if new owner is a member and not already owner
            const targetMember = await prisma.boardMember.findFirst({
                where: {
                    boardId,
                    userId: targetUserId
                }
            })

            if (!targetMember) {
                return status('Not Found', {
                    code: ERROR_CODES.NOT_FOUND,
                    message: 'Target user is not a member of this board'
                })
            }

            if (targetMember.role === MemberRole.OWNER) {
                return status('Not Found', {
                    code: ERROR_CODES.ALREADY_OWNER,
                    message: 'Target user is already the owner'
                })
            }

            // Transfer roles atomically (transaction)
            await prisma.$transaction([
                prisma.boardMember.update({
                    where: { id: owner.id },
                    data: { role: MemberRole.ADMIN }
                }),
                prisma.boardMember.update({
                    where: { id: targetMember.id },
                    data: { role: MemberRole.OWNER }
                })
            ])

            return status('OK', {
                data: {
                    oldOwnerId: owner.userId,
                    newOwnerId: targetMember.userId
                }
            })
        },
        {
            body: 'boardTransferOwner'
        }
    )
