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

/** Swagger description of the `:id` path parameter. */
const ID_PARAM = { name: 'id', format: 'uuid', description: 'Category id' } as const

/** Swagger description of a `400` caused by the body or by an `id` that is not a UUID. */
const INVALID_INPUT = { description: 'Invalid input, or an id that is not a UUID' } as const

/** Swagger description of a `404`: a missing and a foreign category answer alike. */
const NOT_FOUND = { description: 'No category with this id among the categories of the signed-in user' } as const

/** Swagger description of a `409` caused by a name the user already has. */
const DUPLICATE_NAME = { description: 'The signed-in user already has a category with this name' } as const

/**
 * HTTP layer of the categories under `/api/categories`.
 *
 * Takes the owner from the access token and the validated input from the request, hands both to
 * {@link CategoriesService} and returns its answer. It has no logic of its own.
 */
@Controller('categories')
// Swagger
@ApiTags('categories')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categories: CategoriesService) {}

  /**
   * `POST /api/categories`: creates a category of the signed-in user.
   *
   * @param owner - whom the category will belong to, from the access token
   * @param dto - the name
   * @returns the new category
   * @throws ConflictException when the user already has a category with this name
   */
  @Post()
  // Swagger
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ description: 'The new category', type: CategoryDto })
  @ApiBadRequestResponse(INVALID_INPUT)
  @ApiConflictResponse(DUPLICATE_NAME)
  create(@CurrentOwner() owner: Owner, @Body() dto: CreateCategoryDto): Promise<CategoryView> {
    return this.categories.create(owner, dto)
  }

  /**
   * `GET /api/categories`: lists the categories of the signed-in user, by name.
   *
   * @param owner - whose categories to list, from the access token
   * @returns the categories
   */
  @Get()
  // Swagger
  @ApiOperation({ summary: 'The categories of the signed-in user, by name' })
  @ApiOkResponse({ description: 'The categories', type: [CategoryDto] })
  list(@CurrentOwner() owner: Owner): Promise<CategoryView[]> {
    return this.categories.list(owner)
  }

  /**
   * `GET /api/categories/:id`: reads one category of the signed-in user.
   *
   * @param owner - whose category it has to be, from the access token
   * @param id - id of the category; a value that is not a UUID is a `400`
   * @returns the category
   * @throws NotFoundException when the id is not a category of the owner
   */
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

  /**
   * `PATCH /api/categories/:id`: renames a category.
   *
   * @param owner - whose category it has to be, from the access token
   * @param id - id of the category; a value that is not a UUID is a `400`
   * @param dto - the new name
   * @returns the renamed category
   * @throws NotFoundException when the id is not a category of the owner
   * @throws ConflictException when the user already has a category with this name
   */
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

  /**
   * `DELETE /api/categories/:id`: deletes a category that has no transactions.
   *
   * @param owner - whose category it has to be, from the access token
   * @param id - id of the category; a value that is not a UUID is a `400`
   * @throws NotFoundException when the id is not a category of the owner
   * @throws ConflictException when the category has transactions
   */
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
