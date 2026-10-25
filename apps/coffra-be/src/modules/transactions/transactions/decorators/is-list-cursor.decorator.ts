import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { buildMessage, ValidateBy, type ValidationArguments } from 'class-validator'

import { LIST_ORDERS } from '../constants'
import { decodeListCursor, isListCursor } from '../transactions.cursor'
import type { ListOrder } from '../transactions.types'

/**
 * Decodes the cursor from the query string.
 *
 * A cursor that does not decode stays the string it came as, and the first check refuses it.
 *
 * @param params - the value being transformed
 * @returns the decoded cursor, or the value unchanged
 */
const toCursor = ({ value }: TransformFnParams): unknown => decodeListCursor(value) ?? value

/**
 * The check that a cursor was issued for the `order` of the same object.
 *
 * An invalid cursor or order passes here, because its own check reports it, once.
 *
 * @param value - the decoded cursor
 * @param args - the validation arguments; `object` holds the `order`
 * @returns `false` only when both are valid and the cursor was issued for the other order
 */
const isOfOrder = (value: unknown, { object }: ValidationArguments): boolean => {
  const { order } = object as { order?: unknown }

  if (!isListCursor(value) || !LIST_ORDERS.includes(order as ListOrder)) {
    return true
  }

  return value.order === order
}

/**
 * Validates the `nextCursor` of a previous page and decodes it to the position it stands for.
 *
 * Refused when it does not decode, and when it was issued for the other `order` of the same object: in that order it
 * would point to the rows on the other side of the position. Needs `@IsOptional()` for a cursor that may be left out.
 *
 * @returns the property decorator
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
