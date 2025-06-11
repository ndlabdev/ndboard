import { HASH_PASSWORD } from '@constants'
import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

const SUPERADMIN_EMAIL = Bun.env.SUPERADMIN_EMAIL || 'superadmin@example.com'
const SUPERADMIN_PASSWORD = Bun.env.SUPERADMIN_PASSWORD || '123456@Admin'
const SUPERADMIN_NAME = Bun.env.SUPERADMIN_NAME || 'Super Admin'

async function main() {
    const existing = await prisma.user.findUnique({
        where: { email: SUPERADMIN_EMAIL }
    })

    if (existing) {
        console.log(`Superadmin (${SUPERADMIN_EMAIL}) existing!`)
        return
    }

    const hashed = await Bun.password.hash(SUPERADMIN_PASSWORD, HASH_PASSWORD.ALGORITHM)

    await prisma.user.create({
        data: {
            email: SUPERADMIN_EMAIL,
            password: hashed,
            name: SUPERADMIN_NAME,
            role: UserRole.SUPERADMIN,
            isVerified: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
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