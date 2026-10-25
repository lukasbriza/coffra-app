import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { omitUndefined } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Category, isPrismaError, PrismaErrorCode, PrismaService } from '../../prisma'

import { toCategoryView } from './categories.mapper'
import type { CategoryView, CreateCategoryInput, UpdateCategoryInput } from './categories.types'

/** Name of the resource in the `404 Category not found` answer. */
const RESOURCE = 'Category'

/**
 * The categories of one owner.
 *
 * Every query carries the owner scope, so a category of somebody else is never found and ends the same way as a
 * missing one (`404 Category not found`). Names are unique per owner and case-sensitive.
 */
@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /**
   * Lists the categories of the owner by name.
   *
   * Names are unique per owner, the id is there only as the stable tie-breaker.
   *
   * @param owner - whose categories to list
   * @returns the categories; empty when the owner has none
   */
  async list(owner: Owner): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({
      where: this.ownership.scope(owner),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })

    return rows.map(toCategoryView)
  }

  /**
   * Reads one category of the owner.
   *
   * @param owner - whose category it has to be
   * @param id - id of the category
   * @returns the category
   * @throws NotFoundException when the id is not a category of the owner (a missing and a foreign one look alike)
   */
  async findOne(owner: Owner, id: string): Promise<CategoryView> {
    const row = await this.findOwned(owner, id)

    return toCategoryView(row)
  }

  /**
   * Creates a category of the owner.
   *
   * The name is stored as it comes: no case folding, `Food` and `food` are two categories.
   *
   * @param owner - whom the category will belong to
   * @param input - the name
   * @returns the new category
   * @throws ConflictException when the owner already has a category with this name
   * @throws UnauthorizedException when the owner no longer exists: the user was deleted while the access token was still
   * valid, which `GET /api/users/me` and a refresh answer the same way
   */
  async create(owner: Owner, { name }: CreateCategoryInput): Promise<CategoryView> {
    try {
      const row = await this.prisma.category.create({ data: { name, ...this.ownership.ownerData(owner) } })

      return toCategoryView(row)
    } catch (error) {
      this.throwIfDuplicate(error)

      // The owner is the only foreign key of a category.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new UnauthorizedException('Invalid or expired access token')
      }

      throw error
    }
  }

  /**
   * Renames a category of the owner.
   *
   * @param owner - whose category it has to be
   * @param id - id of the category
   * @param input - the fields to change; a field left out stays as it is
   * @returns the renamed category
   * @throws NotFoundException when the id is not a category of the owner, or it was deleted meanwhile
   * @throws ConflictException when the owner already has a category with this name
   */
  async update(owner: Owner, id: string, { name }: UpdateCategoryInput): Promise<CategoryView> {
    await this.findOwned(owner, id)

    try {
      const row = await this.prisma.category.update({
        where: { id, ...this.ownership.scope(owner) },
        data: omitUndefined({ name }),
      })

      return toCategoryView(row)
    } catch (error) {
      this.throwIfDuplicate(error)
      this.throwIfGone(error)
      throw error
    }
  }

  /**
   * Deletes a category of the owner that has no transactions.
   *
   * The database decides whether it has any (`Restrict` on the transactions), not a count made beforehand, so a
   * transaction tagged a moment ago cannot slip through a check made before the delete.
   *
   * @param owner - whose category it has to be
   * @param id - id of the category
   * @throws NotFoundException when the id is not a category of the owner
   * @throws ConflictException when the category has transactions
   */
  async remove(owner: Owner, id: string): Promise<void> {
    await this.findOwned(owner, id)

    try {
      await this.prisma.category.delete({ where: { id, ...this.ownership.scope(owner) } })
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new ConflictException('Category has transactions and cannot be deleted')
      }

      this.throwIfGone(error)
      throw error
    }
  }

  /**
   * Reads a category within the rows of the owner.
   *
   * @param owner - whose category it has to be
   * @param id - id of the category
   * @returns the stored row
   * @throws NotFoundException when the id is not a category of the owner
   */
  private async findOwned(owner: Owner, id: string): Promise<Category> {
    const row = await this.prisma.category.findFirst({ where: { id, ...this.ownership.scope(owner) } })

    return this.ownership.orNotFound(row, RESOURCE)
  }

  /**
   * Turns a unique violation into the 409 of a duplicate name.
   *
   * The unique `(userId, name)` is the check, with no lookup before the write, so two parallel requests cannot both
   * pass. The id is a generated UUID, so a unique violation on a category is always the name; `meta.target` is not
   * read (its shape differs between driver adapters). A second unique constraint would need this narrowed.
   *
   * @param error - whatever the write threw
   * @throws ConflictException when `error` is a unique violation
   */
  private throwIfDuplicate(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.UniqueViolation)) {
      throw new ConflictException('Category with this name already exists')
    }
  }

  /**
   * Turns "the row is gone" into the same 404 as a category that never existed.
   *
   * It happens when the category is deleted between the scoped read and the write.
   *
   * @param error - whatever the write threw
   * @throws NotFoundException when `error` is Prisma's record-not-found
   */
  private throwIfGone(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      this.ownership.orNotFound(null, RESOURCE)
    }
  }
}
