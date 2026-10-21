import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { buildMessage, ValidateBy, type ValidationArguments } from 'class-validator'

import { LIST_ORDERS } from '../constants'
import { decodeListCursor, isListCursor } from '../transactions.cursor'
import type { ListOrder } from '../transactions.types'

// A cursor that does not decode stays the string it came as, and the first check refuses it.
const toCursor = ({ value }: TransformFnParams): unknown => decodeListCursor(value) ?? value

const isOfOrder = (value: unknown, { object }: ValidationArguments): boolean => {
  const { order } = object as { order?: unknown }

  // An invalid cursor or order is reported by its own check, once.
  if (!isListCursor(value) || !LIST_ORDERS.includes(order as ListOrder)) {
    return true
  }

  return value.order === order
}

/**
 * The `nextCursor` of a previous page, decoded to the position it stands for. Refused when it does not decode, and
 * when it was issued for the other `order` of the same object: in that order it would point to the rows on the other
 * side of the position. Needs `@IsOptional()` for a cursor that may be left out.
 */
export const IsListCursor = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    Transform(toCursor),
    ValidateBy({
      name: 'isListCursor',
      validator: {
        validate: isListCursor,
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be the nextCursor of a previous page, as it came`,
        ),
      },
    }),
    ValidateBy({
      name: 'isListCursorOfOrder',
      validator: {
        validate: isOfOrder,
        defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property was issued for the other order`),
      },
    }),
  )
