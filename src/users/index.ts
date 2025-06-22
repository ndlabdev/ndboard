// ** Elysia Imports
import { Elysia } from 'elysia';

// ** Controllers Imports
import { authController } from './auth/auth.controller';
import { workspaceController } from './workspace/workspace.controller';
// import { boardController } from './board/board.controller'
// import { listController } from './list/list.controller'

export const users = new Elysia({ prefix: '/api/users' })
    .use(authController)
    .use(workspaceController)
// .use(boardController)
// .use(listController)
