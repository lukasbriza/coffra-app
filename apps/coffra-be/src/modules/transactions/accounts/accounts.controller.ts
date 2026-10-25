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

import { AccountsService } from './accounts.service'
import type { AccountView } from './accounts.types'
import { AccountDto } from './dto/account.dto'
import { BalanceQueryDto } from './dto/balance-query.dto'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto } from './dto/update-account.dto'

/** Swagger description of the `:id` path parameter. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Account id' } as const

/** Swagger description of a `400` caused by the body or by an `id` that is not a UUID. */
const INVALID_INPUT = { description: 'Invalid input, or an id that is not a UUID' } as const

/** Swagger description of a `404`: a missing and a foreign account answer alike. */
const NOT_FOUND = { description: 'No account with this id among the accounts of the signed-in user' } as const

/**
 * HTTP layer of the accounts under `/api/accounts`.
 *
 * Takes the owner from the access token and the validated input from the request, hands both to
 * {@link AccountsService} and returns its answer. It has no logic of its own.
 */
@Controller('accounts')
// Swagger
@ApiTags('accounts')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  /**
   * `POST /api/accounts`: creates an account of the signed-in user.
   *
   * @param owner - whom the account will belong to, from the access token
   * @param dto - name, type, currency and optionally the opening balance
   * @returns the new account; its balance is its opening balance
   */
  @Post()
  // Swagger
  @ApiOperation({ summary: 'Create an account; its balance is its opening balance' })
  @ApiCreatedResponse({ description: 'The new account', type: AccountDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  create(@CurrentOwner() owner: Owner, @Body() dto: CreateAccountDto): Promise<AccountView> {
    return this.accounts.create(owner, dto)
  }

  /**
   * `GET /api/accounts`: lists the accounts of the signed-in user, by name.
   *
   * @param owner - whose accounts to list, from the access token
   * @param query - the day the balances are counted to (`asOf`)
   * @returns every account with its balance up to `asOf`
   */
  @Get()
  // Swagger
  @ApiOperation({ summary: 'The accounts of the signed-in user, by name, each with its balance up to `asOf`' })
  @ApiOkResponse({ description: 'The accounts', type: [AccountDto] })
  @ApiBadRequestResponse({ description: '`asOf` is not a calendar day `YYYY-MM-DD`, or is given more than once' })
  list(@CurrentOwner() owner: Owner, @Query() query: BalanceQueryDto): Promise<AccountView[]> {
    return this.accounts.list(owner, query)
  }

  /**
   * `GET /api/accounts/:id`: reads one account of the signed-in user.
   *
   * @param owner - whose account it has to be, from the access token
   * @param id - id of the account; a value that is not a UUID is a `400`
   * @param query - the day the balance is counted to (`asOf`)
   * @returns the account with its balance up to `asOf`
   * @throws NotFoundException when the id is not an account of the owner
   */
  @Get(':id')
  // Swagger
  @ApiOperation({ summary: 'One account with its balance up to `asOf`' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The account', type: AccountDto })
  @ApiBadRequestResponse({
    description: 'An id that is not a UUID, or an `asOf` that is not a calendar day `YYYY-MM-DD` or is given twice',
  })
  @ApiNotFoundResponse(NOT_FOUND)
  findOne(
    @CurrentOwner() owner: Owner,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: BalanceQueryDto,
  ): Promise<AccountView> {
    return this.accounts.findOne(owner, id, query)
  }

  /**
   * `PATCH /api/accounts/:id`: changes the name, the type or the opening balance of an account.
   *
   * The currency cannot change (a body with `currency` is a `400`). The balance in the answer is the one of today.
   *
   * @param owner - whose account it has to be, from the access token
   * @param id - id of the account; a value that is not a UUID is a `400`
   * @param dto - the fields to change
   * @returns the whole changed account
   * @throws NotFoundException when the id is not an account of the owner
   */
  @Patch(':id')
  // Swagger
  @ApiOperation({
    summary:
      'Change the name, the type or the opening balance. The currency cannot change. The balance in the answer is the one of today.',
  })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The changed account', type: AccountDto })
  @ApiBadRequestResponse({ description: 'Invalid input, a currency, or an id that is not a UUID' })
  @ApiNotFoundResponse(NOT_FOUND)
  update(
    @CurrentOwner() owner: Owner,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountView> {
    return this.accounts.update(owner, id, dto)
  }

  /**
   * `DELETE /api/accounts/:id`: deletes an account that has no transactions.
   *
   * @param owner - whose account it has to be, from the access token
   * @param id - id of the account; a value that is not a UUID is a `400`
   * @throws NotFoundException when the id is not an account of the owner
   * @throws ConflictException when the account has transactions
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Swagger
  @ApiOperation({ summary: 'Delete an account that has no transactions' })
  @ApiParam(ID_PARAM)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiConflictResponse({ description: 'The account has transactions' })
  remove(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.accounts.remove(owner, id)
  }
}
