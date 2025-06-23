import { Password } from 'bun'

export const HASH_PASSWORD = {
    ALGORITHM: 'bcrypt' as Password.AlgorithmLabel
}

export const JWT = {
    ACCESS_TOKEN_NAME: 'jwtAccessToken',
    ACCESS_TOKEN_EXP: 1 * 60 * 60, // 1 hours
    REFRESH_TOKEN_NAME: 'jwtRefreshToken',
    REFRESH_TOKEN_EXP: 7 * 24 * 60 * 60, // 7 days
    EXPIRE_AT: 7 * 24 * 60 * 60 * 1000
}

export const ADMIN_ACTIONS = {
    LOGIN: 'LOGIN',
    LOGIN_FAIL_PASSWORD: 'LOGIN_FAIL_PASSWORD',
    LOGIN_FAIL_ROLE: 'LOGIN_FAIL_ROLE',
    LOGIN_FAIL_LOCKED: 'LOGIN_FAIL_LOCKED',
    LOGOUT: 'LOGOUT',
    CHANGE_PASSWORD: 'CHANGE_PASSWORD',
    UPDATE_PROFILE: 'UPDATE_PROFILE',
} as const

export const ADMIN_TARGET_TYPES = {
    USER: 'user',
    BOARD: 'board'
} as const

export const PAGE = {
    CURRENT: 1,
    SIZE: 10
}

export type AdminTargetType = typeof ADMIN_TARGET_TYPES[keyof typeof ADMIN_TARGET_TYPES]
export type AdminAction = typeof ADMIN_ACTIONS[keyof typeof ADMIN_ACTIONS]

export const ROLE = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    DEFAULT: 'user',
    GUEST: 'guest'
} as const

export const AUDIT_ACTION = {
    REGISTER: 'register',
    LOGIN: 'login'
} as const

export const WORKSPACE_ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
} as const

export const BOARD_VISIBILITY = {
    PRIVATE: 'private',
    WORKSPACE: 'workspace',
    PUBLIC: 'public',
} as const