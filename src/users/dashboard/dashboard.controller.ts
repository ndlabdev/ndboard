// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import { dashboardViewBoard } from './dashboard.service'

export const dashboardController = new Elysia({
    prefix: '/dashboard'
})
    .use(dashboardViewBoard)
