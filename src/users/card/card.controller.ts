// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Service Imports
import {
    cardAddChecklist,
    cardAddChecklistItem,
    cardAddComment,
    cardArchive,
    cardBulkReorder,
    cardCompleteChecklistItem,
    cardCreate,
    cardDelete,
    cardDeleteChecklist,
    cardDeleteChecklistItem,
    cardDetail,
    cardGetArchiveList,
    cardGetByList,
    cardMove,
    cardRenameChecklistItem,
    cardReorder,
    cardRestore,
    cardUpdate,
    cardUpdateChecklist
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
    .use(cardDelete)
    .use(cardAddChecklist)
    .use(cardAddChecklistItem)
    .use(cardDeleteChecklistItem)
    .use(cardDeleteChecklist)
    .use(cardCompleteChecklistItem)
    .use(cardRenameChecklistItem)
    .use(cardUpdateChecklist)
    .use(cardAddComment)
