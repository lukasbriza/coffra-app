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

// `:pairId`, not `:id`: the id of a transfer is the `transferPairId` of its two transactions, never the id of one.
const PAIR_ID_PARAM = {
  name: 'pairId',
  format: 'uuid',
  description: 'Id of the transfer: the `transferPairId` of both of its transactions',
} as const
const NOT_FOUND = { description: 'No transfer with this pairId among the transactions of the signed-in user' } as const

// No read: both transactions of a transfer, with their `transferPairId`, come from `GET /api/transactions`.
@Controller('transfers')
// Swagger
@ApiTags('transfers')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class TransfersController {
  constructor(@Inject(TransfersService) private readonly transfers: TransfersService) {}

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
