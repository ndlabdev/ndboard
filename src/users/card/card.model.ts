// ** Elysia Imports
import { Elysia } from 'elysia'

// ** Types Imports
import { cardCreateType } from './card.type'

export const cardModels = new Elysia().model({
    cardCreate: cardCreateType
})
