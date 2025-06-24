// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Controllers Imports
import { authController } from './auth/auth.controller'
import { boardController } from './board/board.controller'
import { listController } from './list/list.controller'
import { workspaceController } from './workspace/workspace.controller'
import { cardController } from './card/card.controller'

export const users = new Elysia({
    prefix: '/api/users'
})
    .use(authController)
    .use(boardController)
    .use(workspaceController)
    .use(listController)
    .use(cardController)
