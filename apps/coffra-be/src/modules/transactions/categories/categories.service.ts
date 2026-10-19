import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { omitUndefined } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Category, isPrismaError, PrismaErrorCode, PrismaService } from '../../prisma'

import { toCategoryView } from './categories.mapper'
import type { CategoryView, CreateCategoryInput, UpdateCategoryInput } from './categories.types'

const RESOURCE = 'Category'

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /** The owner's categories by name. Names are unique per owner, the id is there only as the stable tie-breaker. */
  async list(owner: Owner): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({
      where: this.ownership.scope(owner),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })

    return rows.map(toCategoryView)
  }

  async findOne(owner: Owner, id: string): Promise<CategoryView> {
    const row = await this.findOwned(owner, id)

    return toCategoryView(row)
  }

  /** The name is stored as it comes: no case folding, `Food` and `food` are two categories. */
  async create(owner: Owner, { name }: CreateCategoryInput): Promise<CategoryView> {
    try {
      const row = await this.prisma.category.create({ data: { name, ...this.ownership.ownerData(owner) } })

      return toCategoryView(row)
    } catch (error) {
      this.throwIfDuplicate(error)

      // The owner is the only foreign key of a category: the user was deleted while the access token was still
      // valid. The same answer as `GET /api/users/me` and a refresh give then.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new UnauthorizedException('Invalid or expired access token')
      }

      throw error
    }
  }

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

  async remove(owner: Owner, id: string): Promise<void> {
    await this.findOwned(owner, id)

    try {
      await this.prisma.category.delete({ where: { id, ...this.ownership.scope(owner) } })
    } catch (error) {
      // `Restrict` on the transactions of the category: the database decides, so a transaction tagged a moment ago
      // cannot slip through a check made before the delete.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new ConflictException('Category has transactions and cannot be deleted')
      }

      this.throwIfGone(error)
      throw error
    }
  }

  private async findOwned(owner: Owner, id: string): Promise<Category> {
    const row = await this.prisma.category.findFirst({ where: { id, ...this.ownership.scope(owner) } })

    return this.ownership.orNotFound(row, RESOURCE)
  }

  /**
   * The unique `(userId, name)` is the check, with no lookup before the write, so two parallel requests cannot both
   * pass. The id is a generated UUID, so a unique violation on a category is always the name; `meta.target` is not
   * read (its shape differs between driver adapters). A second unique constraint would need this narrowed.
   */
  private throwIfDuplicate(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.UniqueViolation)) {
      throw new ConflictException('Category with this name already exists')
    }
  }

  /** The row was deleted between the scoped read and the write: the same 404 as a category that never existed. */
  private throwIfGone(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      this.ownership.orNotFound(null, RESOURCE)
    }
  }
}
