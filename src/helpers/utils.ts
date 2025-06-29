// ** Prisma Imports
import prisma from '@db'

export async function generateUsername(name: string, email: string): Promise<string> {
    let base = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '')

    if (!base || base.length < 3) {
        base = email.split('@')[0]
    }

    let username = base
    let count = 0
    let existed = await prisma.user.findUnique({
        where: {
            username
        }
    })

    while (existed) {
        count++
        username = base + count
        existed = await prisma.user.findUnique({
            where: {
                username
            }
        })
    }

    return username
}
