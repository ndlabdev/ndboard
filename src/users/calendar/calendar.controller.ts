// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import { calendarViewBoard } from './calendar.service'

export const calendarController = new Elysia({
    prefix: '/calendar'
})
    .use(calendarViewBoard)
