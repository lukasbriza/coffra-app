import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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

import { CreateTransactionDto } from './dto/create-transaction.dto'
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto'
import { TransactionPageDto } from './dto/transaction-page.dto'
import { TransactionDto } from './dto/transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'
import { TransactionsService } from './transactions.service'
import type { TransactionPage, TransactionView } from './transactions.types'

const ID_PARAM = { name: 'id', format: 'uuid', description: 'Transaction id' } as const
const INVALID_INPUT = { description: 'Invalid input, or an id that is not a UUID' } as const
const NOT_FOUND = { description: 'No transaction with this id among the transactions of the signed-in user' } as const
const TRANSFER_SIDE = 'The transaction is one side of a transfer: change or delete the transfer instead'

@Controller('transactions')
// Swagger
@ApiTags('transactions')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class TransactionsController {
  constructor(@Inject(TransactionsService) private readonly transactions: TransactionsService) {}

  @Post()
  // Swagger
  @ApiOperation({ summary: 'Record an income or an expense' })
  @ApiCreatedResponse({ description: 'The new transaction', type: TransactionDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse({
    description: 'The account or the category of the body is not among those of the signed-in user',
  })
  create(@CurrentOwner() owner: Owner, @Body() dto: CreateTransactionDto): Promise<TransactionView> {
    return this.transactions.create(owner, dto)
  }

  @Get()
  // Swagger
  @ApiOperation({
    summary: 'Transactions of the signed-in user, filtered, ordered and paged by a cursor; transfer sides included',
  })
  @ApiOkResponse({
    description: 'One page of the matching transactions and the cursor of the next one',
    type: TransactionPageDto,
  })
  @ApiBadRequestResponse({
    description:
      'A malformed id or date, an unknown type or order, `to` before `from`, `limit` out of range, or a cursor that is not a `nextCursor` or was issued for the other order',
  })
  list(@CurrentOwner() owner: Owner, @Query() query: ListTransactionsQueryDto): Promise<TransactionPage> {
    return this.transactions.list(owner, query)
  }

  @Get(':id')
  // Swagger
  @ApiOperation({ summary: 'One transaction, one side of a transfer included' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The transaction', type: TransactionDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  findOne(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<TransactionView> {
    return this.transactions.findOne(owner, id)
  }

  @Patch(':id')
  // Swagger
  @ApiOperation({
    summary: 'Change an income or an expense: amount, date, note, category, type, or account of the same currency',
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The changed transaction', type: TransactionDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse({
    description:
      'No such transaction, account or category among those of the signed-in user (the id, or a reference in the body)',
  })
  @ApiConflictResponse({ description: `${TRANSFER_SIDE}; or the new account has another currency` })
  update(
    @CurrentOwner() owner: Owner,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionView> {
    return this.transactions.update(owner, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Swagger
  @ApiOperation({ summary: 'Delete an income or an expense' })
  @ApiParam(ID_PARAM)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiConflictResponse({ description: TRANSFER_SIDE })
  remove(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.transactions.remove(owner, id)
  }
}
