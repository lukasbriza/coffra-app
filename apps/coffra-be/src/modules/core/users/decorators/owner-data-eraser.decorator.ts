import { DiscoveryService } from '@nestjs/core'

/**
 * Marks the provider of a domain that erases the data of an owner when its user is deleted.
 *
 * The class implements `OwnerDataEraserInterface` and is a provider of a module the app imports. `UserDeletionService`
 * finds it through `DiscoveryService`, so registering it needs nothing else and `core` imports no domain.
 *
 * @example
 * ```ts
 * @Injectable()
 * @OwnerDataEraser()
 * export class TransactionsDataEraser implements OwnerDataEraserInterface {}
 * ```
 */
export const OwnerDataEraser = DiscoveryService.createDecorator()
