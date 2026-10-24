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

/** Swagger description of the `:id` path parameter. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Transaction id' } as const

/** Swagger description of a `400` caused by the body or by an `id` that is not a UUID. */
const INVALID_INPUT = { description: 'Invalid input, or an id that is not a UUID' } as const

/** Swagger description of a `404`: a missing and a foreign transaction answer alike. */
const NOT_FOUND = { description: 'No transaction with this id among the transactions of the signed-in user' } as const

/** Swagger description of a `409` on a side of a transfer, which only the transfer API changes. */
const TRANSFER_SIDE =
  'The transaction is one side of a transfer: change or delete the transfer instead (`/api/transfers/{transferPairId}`)'

/**
 * HTTP layer of the income and expense under `/api/transactions`.
 *
 * Takes the owner from the access token and the validated input from the request, hands both to
 * {@link TransactionsService} and returns its answer. It has no logic of its own.
 */
@Controller('transactions')
// Swagger
@ApiTags('transactions')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class TransactionsController {
  constructor(@Inject(TransactionsService) private readonly transactions: TransactionsService) {}

  /**
   * `POST /api/transactions`: records an income or an expense.
   *
   * @param owner - whom the transaction will belong to, from the access token
   * @param dto - account, type, amount, date, and optionally category and note
   * @returns the new transaction
   * @throws NotFoundException when the account or the category of the body is not among those of the owner
   */
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

  /**
   * `GET /api/transactions`: lists the transactions of the signed-in user, filtered, ordered and paged by a cursor.
   *
   * Both sides of a transfer are in the list.
   *
   * @param owner - whose transactions to list, from the access token
   * @param query - the filters, the order and the position of the page
   * @returns one page and the cursor of the next one
   */
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

  /**
   * `GET /api/transactions/:id`: reads one transaction, one side of a transfer included.
   *
   * @param owner - whose transaction it has to be, from the access token
   * @param id - id of the transaction; a value that is not a UUID is a `400`
   * @returns the transaction
   * @throws NotFoundException when the id is not a transaction of the owner
   */
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

  /**
   * `PATCH /api/transactions/:id`: changes an income or an expense.
   *
   * @param owner - whose transaction it has to be, from the access token
   * @param id - id of the transaction; a value that is not a UUID is a `400`
   * @param dto - the fields to change
   * @returns the whole changed transaction
   * @throws NotFoundException when the transaction, the account or the category is not among those of the owner
   * @throws ConflictException when the transaction is a side of a transfer, or the new account has another currency
   */
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

  /**
   * `DELETE /api/transactions/:id`: deletes an income or an expense.
   *
   * @param owner - whose transaction it has to be, from the access token
   * @param id - id of the transaction; a value that is not a UUID is a `400`
   * @throws NotFoundException when the id is not a transaction of the owner
   * @throws ConflictException when the transaction is a side of a transfer
   */
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
