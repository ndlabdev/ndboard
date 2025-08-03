// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    cardArchive,
    cardBulkReorder,
    cardCreate,
    cardDetail,
    cardGetArchiveList,
    cardGetByList,
    cardMove,
    cardReorder,
    cardRestore,
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
    .use(cardGetByList)
    .use(cardReorder)
    .use(cardBulkReorder)
    .use(cardGetArchiveList)
    .use(cardRestore)
