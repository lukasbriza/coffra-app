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

import { CategoriesService } from './categories.service'
import type { CategoryView } from './categories.types'
import { CategoryDto } from './dto/category.dto'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

const ID_PARAM = { name: 'id', format: 'uuid', description: 'Category id' } as const
const INVALID_INPUT = { description: 'Invalid input, or an id that is not a UUID' } as const
const NOT_FOUND = { description: 'No category with this id among the categories of the signed-in user' } as const
const DUPLICATE_NAME = { description: 'The signed-in user already has a category with this name' } as const

@Controller('categories')
// Swagger
@ApiTags('categories')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categories: CategoriesService) {}

  @Post()
  // Swagger
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ description: 'The new category', type: CategoryDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiConflictResponse(DUPLICATE_NAME)
  create(@CurrentOwner() owner: Owner, @Body() dto: CreateCategoryDto): Promise<CategoryView> {
    return this.categories.create(owner, dto)
  }

  @Get()
  // Swagger
  @ApiOperation({ summary: 'The categories of the signed-in user, by name' })
  @ApiOkResponse({ description: 'The categories', type: [CategoryDto] })
  list(@CurrentOwner() owner: Owner): Promise<CategoryView[]> {
    return this.categories.list(owner)
  }

  @Get(':id')
  // Swagger
  @ApiOperation({ summary: 'One category' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The category', type: CategoryDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  findOne(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<CategoryView> {
    return this.categories.findOne(owner, id)
  }

  @Patch(':id')
  // Swagger
  @ApiOperation({ summary: 'Rename a category' })
  @ApiParam(ID_PARAM)
  @ApiOkResponse({ description: 'The renamed category', type: CategoryDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiConflictResponse(DUPLICATE_NAME)
  update(
    @CurrentOwner() owner: Owner,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryView> {
    return this.categories.update(owner, id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Swagger
  @ApiOperation({ summary: 'Delete a category that has no transactions' })
  @ApiParam(ID_PARAM)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiConflictResponse({ description: 'The category has transactions: move or clear them first' })
  remove(@CurrentOwner() owner: Owner, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categories.remove(owner, id)
  }
}
