/**
 * Centralized Redis Cache Keys
 * Use template functions for dynamic keys
 */

export const CACHE_KEYS = {
    // Workspace
    WORKSPACE_LIST: (userId: string, query?: Record<string, unknown>) =>
        `workspace:list:${userId}:${query ? JSON.stringify(query) : 'default'}`,

    WORKSPACE_DETAIL: (userId: string, workspaceId: string) =>
        `workspace:detail:${userId}:${workspaceId}`,

    // Board
    BOARD_LIST: (userId: string, workspaceId: string) =>
        `board:list:${userId}:${workspaceId}`,

    BOARD_DETAIL: (userId: string, boardId: string) =>
        `board:detail:${userId}:${boardId}`
} as const
