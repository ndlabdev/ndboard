import { Password } from 'bun'

export const HASH_PASSWORD = {
    ALGORITHM: 'argon2id' as Password.AlgorithmLabel
}

export const JWT = {
    ACCESS_TOKEN_NAME: 'jwtAccessToken',
    ACCESS_TOKEN_EXP: 1 * 60 * 60, // 1 hours
    REFRESH_TOKEN_NAME: 'jwtRefreshToken',
    REFRESH_TOKEN_EXP: 7 * 24 * 60 * 60, // 7 days
    EXPIRE_AT: 7 * 24 * 60 * 60 * 1000
}
