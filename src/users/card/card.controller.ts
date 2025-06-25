// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    cardArchive,
    cardCreate,
    cardDetail,
    cardMove,
    cardUpdate
} from './card.service'

export const cardController = new Elysia({
    prefix: '/cards'
})
    .use(cardCreate)
    .use(cardDetail)
    .use(cardUpdate)
    .use(cardArchive)
    .use(cardMove)