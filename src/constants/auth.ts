export const AUTH_SECURITY = {
    MAX_FAILED_ATTEMPTS: 5,
    LOCK_TIME_MINUTES: 30
} as const

export const PROVIDER = {
    GOOGLE: 'google',
    GITHUB: 'github'
} as const
