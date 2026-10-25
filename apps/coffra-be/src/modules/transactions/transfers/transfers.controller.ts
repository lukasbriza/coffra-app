import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { CurrentOwner, type Owner } from '../../core'

import { CreateTransferDto } from './dto/create-transfer.dto'
import { TransferDto } from './dto/transfer.dto'
import { UpdateTransferDto } from './dto/update-transfer.dto'
import { TransfersService } from './transfers.service'
import type { TransferView } from './transfers.types'

/**
 * Swagger description of the `:pairId` path parameter.
 *
 * `:pairId`, not `:id`: the id of a transfer is the `transferPairId` of its two transactions, never the id of one.
 */
const PAIR_ID_PARAM = {
  name: 'pairId',
  format: 'uuid',
  description: 'Id of the transfer: the `transferPairId` of both of its transactions',
} as const

/** Swagger description of a `404`: a missing and a foreign transfer answer alike. */
const NOT_FOUND = { description: 'No transfer with this pairId among the transactions of the signed-in user' } as const

/**
 * HTTP layer of the transfers under `/api/transfers`: create, change and delete.
 *
 * There is no read: both transactions of a transfer, with their `transferPairId`, come from `GET /api/transactions`.
 * Takes the owner from the access token and the validated input from the request, hands both to
 * {@link TransfersService} and returns its answer. It has no logic of its own.
 */
@Controller('transfers')
// Swagger
@ApiTags('transfers')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class TransfersController {
  constructor(@Inject(TransfersService) private readonly transfers: TransfersService) {}

  /**
   * `POST /api/transfers`: moves money between two accounts of the signed-in user in the same currency.
   *
   * @param owner - whose accounts they have to be, from the access token
   * @param dto - source account, target account, amount, date, and optionally a note
   * @returns the new transfer
   * @throws NotFoundException when an account of the body is not among those of the owner
   * @throws ConflictException when the two accounts have different currencies
   */
  @Post()
  // Swagger
  @ApiOperation({ summary: 'Move money between two own accounts in the same currency' })
  @ApiCreatedResponse({ description: 'The new transfer', type: TransferDto })
  @ApiBadRequestResponse({
    description: 'Invalid input, the same account on both sides, or a category (a transfer never has one)',
  })
  @ApiNotFoundResponse({ description: 'An account of the body is not among those of the signed-in user' })
  @ApiConflictResponse({ description: 'The two accounts have different currencies' })
  create(@CurrentOwner() owner: Owner, @Body() dto: CreateTransferDto): Promise<TransferView> {
    return this.transfers.create(owner, dto)
  }

  /**
   * `PATCH /api/transfers/:pairId`: changes a transfer, both of its transactions at once.
   *
   * @param owner - whose transfer and accounts they have to be, from the access token
   * @param pairId - id of the transfer; a value that is not a UUID is a `400`
   * @param dto - the fields to change
   * @returns the whole changed transfer
   * @throws NotFoundException when the transfer, or a new account, is not among those of the owner
   * @throws ConflictException when a new account has another currency than the transfer, or the same account would be
   * on both sides
   */
  @Patch(':pairId')
  // Swagger
  @ApiOperation({
    summary:
      'Change a transfer, both of its transactions at once: amount, date, note, or an account of the same currency',
  })
  @ApiParam(PAIR_ID_PARAM)
  @ApiOkResponse({ description: 'The changed transfer', type: TransferDto })
  @ApiBadRequestResponse({
    description: 'Invalid input, the same account twice in the body, a category, or a pairId that is not a UUID',
  })
  @ApiNotFoundResponse({
    description: 'No such transfer, or a new account that is not among those of the signed-in user',
  })
  @ApiConflictResponse({
    description:
      'A new account has another currency than the transfer, or with the side that stays the same account would be on both sides',
  })
  update(
    @CurrentOwner() owner: Owner,
    @Param('pairId', ParseUUIDPipe) pairId: string,
    @Body() dto: UpdateTransferDto,
  ): Promise<TransferView> {
    return this.transfers.update(owner, pairId, dto)
  }

  /**
   * `DELETE /api/transfers/:pairId`: deletes a transfer, both of its transactions at once.
   *
   * @param owner - whose transfer it has to be, from the access token
   * @param pairId - id of the transfer; a value that is not a UUID is a `400`
   * @throws NotFoundException when the pairId is not a transfer of the owner
   */
  @Delete(':pairId')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Swagger
  @ApiOperation({ summary: 'Delete a transfer, both of its transactions at once' })
  @ApiParam(PAIR_ID_PARAM)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiBadRequestResponse({ description: 'The pairId is not a UUID' })
  @ApiNotFoundResponse(NOT_FOUND)
  remove(@CurrentOwner() owner: Owner, @Param('pairId', ParseUUIDPipe) pairId: string): Promise<void> {
    return this.transfers.remove(owner, pairId)
  }
}
