/**
 * Centralized Redis Cache Keys
 * Use template functions for dynamic keys
 */

export const CACHE_KEYS = {
    // Workspace
    WORKSPACE_LIST: (userId: string, query?: Record<string, unknown>) =>
        `workspace:list:${userId}:${query ? JSON.stringify(query) : 'default'}`,

    WORKSPACE_DETAIL: (workspaceId: string) =>
        `workspace:detail:${workspaceId}`
} as const
