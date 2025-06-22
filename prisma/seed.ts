import { HASH_PASSWORD, ROLE } from '@constants'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUPERADMIN_EMAIL = Bun.env.SUPERADMIN_EMAIL || 'superadmin@example.com'
const SUPERADMIN_PASSWORD = Bun.env.SUPERADMIN_PASSWORD || '123456@Admin'
const SUPERADMIN_NAME = Bun.env.SUPERADMIN_NAME || 'Super Admin'

async function main() {
    const roles = [
        { name: ROLE.SUPERADMIN, description: 'Super administrator' },
        { name: ROLE.ADMIN, description: 'System administrator' },
        { name: ROLE.DEFAULT, description: 'Default user role' },
        { name: ROLE.GUEST, description: 'Read-only user' }
    ]

    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: role
        })
    }

    const existing = await prisma.user.findUnique({
        where: { email: SUPERADMIN_EMAIL }
    })

    if (existing) {
        console.log(`Superadmin (${SUPERADMIN_EMAIL}) existing!`)
        return
    }

    const superAdminRole = await prisma.role.findUnique({
        where: { name: ROLE.SUPERADMIN }
    })
    if (!superAdminRole) throw new Error('Super admin role not found')

    const hashed = await Bun.password.hash(SUPERADMIN_PASSWORD, HASH_PASSWORD.ALGORITHM)

    await prisma.user.create({
        data: {
            email: SUPERADMIN_EMAIL,
            password: hashed,
            username: ROLE.SUPERADMIN,
            name: SUPERADMIN_NAME,
            isVerified: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            roleId: superAdminRole.id
        }
    })

    console.log(`${SUPERADMIN_NAME} Created!`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
