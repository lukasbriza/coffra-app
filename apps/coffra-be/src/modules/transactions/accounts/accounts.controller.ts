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
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto } from './dto/update-account.dto'

const ID_PARAM = { name: 'id', format: 'uuid', description: 'Account id' } as const
const INVALID_INPUT = { description: 'Invalid input, or an id that is not a UUID' } as const
const NOT_FOUND = { description: 'No account with this id among the accounts of the signed-in user' } as const

@Controller('accounts')
// Swagger
@ApiTags('accounts')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  @Post()
  // Swagger
  @ApiOperation({ summary: 'Create an account' })
  @ApiCreatedResponse({ description: 'The new account', type: AccountDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  create(@CurrentOwner() owner: Owner, @Body() dto: CreateAccountDto): Promise<AccountView> {
    return this.accounts.create(owner, dto)
  }

  @Get()
  // Swagger
  @ApiOperation({ summary: 'The accounts of the signed-in user, by name' })
  @ApiOkResponse({ description: 'The accounts', type: [AccountDto] })
  list(@CurrentOwner() owner: Owner): Promise<AccountView[]> {
    return this.accounts.list(owner)
  }

  @Get(':id')
  // Swagger
  @ApiOperation({ summary: 'One account' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The account', type: AccountDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  findOne(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<AccountView> {
    return this.accounts.findOne(owner, id)
  }

  @Patch(':id')
  // Swagger
  @ApiOperation({ summary: 'Change the name, the type or the opening balance. The currency cannot change.' })
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
