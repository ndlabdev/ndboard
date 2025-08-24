// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Third Party Imports
import Redis from 'ioredis'

class RedisClient {
    private redisClient: Redis

    constructor(_connectionString?: string) {
        this.redisClient = _connectionString ? new Redis(_connectionString, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        }) : new Redis({
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        })

        this.redisClient.on('error', (error) => {
            console.error('[Redis] Error:', error)
        })

        this.redisClient.on('close', () => {
            console.error('[Redis] Connection closed.')
        })
    }

    getRawInstance() {
        return this.redisClient
    }

    async set(key: string, value: string) {
        return this.redisClient.set(key, value)
    }

    async get(key: string) {
        return this.redisClient.get(key)
    }

    async del(key: string) {
        return this.redisClient.del(key)
    }

    async forgetAll() {
        return this.redisClient.flushall()
    }

    async sadd(key: string, value: any) {
        return this.redisClient.sadd(key, value)
    }

    async smembers(key: string) {
        return this.redisClient.smembers(key)
    }

    async srem(key: string, value: string) {
        return this.redisClient.srem(key, value)
    }
}

export const redisClient = new RedisClient(Bun.env.REDIS_URL)
export type RedisClientType = InstanceType<typeof RedisClient>

export const redisPlugin = (app: Elysia) =>
    app.decorate({
        redis: redisClient
    })
