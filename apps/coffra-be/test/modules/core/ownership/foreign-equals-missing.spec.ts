import 'reflect-metadata'

import { Controller, Get, Inject, type INestApplication, Param } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { configureApp } from '../../../../src/app.setup'
import type { AuthenticatedRequest } from '../../../../src/modules/core/auth/types'
import { CurrentOwner } from '../../../../src/modules/core/ownership/decorators/current-owner.decorator'
import { OwnershipModule } from '../../../../src/modules/core/ownership/ownership.module'
import { OwnershipService } from '../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../src/modules/core/ownership/ownership.types'

// The ownership layer composed the way a domain uses it, over HTTP: `@CurrentOwner()`, `scope` in the query and
// `orNotFound` on the result. The store is a stand-in for Prisma that matches every key of the `where`, so a
// query without the scope finds the rows of other owners, as the database would.

const USER_A = '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11'
const USER_B = '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62'
const ACCOUNT_OF_A = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const ACCOUNT_OF_B = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const MISSING = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

type Row = { id: string; userId: string; name: string }

const ROWS: Row[] = [
  { id: ACCOUNT_OF_A, userId: USER_A, name: 'Cash of A' },
  { id: ACCOUNT_OF_B, userId: USER_B, name: 'Cash of B' },
]

const matches = (row: Row, where: Partial<Row>): boolean =>
  Object.entries(where).every(([key, value]) => row[key as keyof Row] === value)

/** Just enough of `prisma.account` for the probe: filters on every key of `where`, like a SQL `WHERE`. */
const store = {
  findMany: ({ where }: { where: Partial<Row> }): Row[] => ROWS.filter((row) => matches(row, where)),
  findFirst: ({ where }: { where: Partial<Row> }): Row | null => ROWS.find((row) => matches(row, where)) ?? null,
}

/** A domain route as T14 writes it, not part of the app. */
@Controller('probe-accounts')
class ProbeAccountsController {
  constructor(@Inject(OwnershipService) private readonly ownership: OwnershipService) {}

  @Get()
  list(@CurrentOwner() owner: Owner): Row[] {
    return store.findMany({ where: { ...this.ownership.scope(owner) } })
  }

  @Get(':id')
  findOne(@CurrentOwner() owner: Owner, @Param('id') id: string): Row {
    return this.ownership.orNotFound(store.findFirst({ where: { id, ...this.ownership.scope(owner) } }), 'Account')
  }
}

describe('a foreign row and a missing row', () => {
  let app: INestApplication
  let userId = USER_A

  const server = (): App => app.getHttpServer() as App

  beforeEach(async () => {
    userId = USER_A

    const moduleRef = await Test.createTestingModule({
      imports: [OwnershipModule],
      controllers: [ProbeAccountsController],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    // Stands in for `JwtAuthGuard`: the request is signed in as `userId`.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      ;(req as AuthenticatedRequest).auth = { userId }
      next()
    })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('answer exactly the same, so the API never reveals that a foreign id exists', async () => {
    const foreign = await request(server()).get(`/api/probe-accounts/${ACCOUNT_OF_B}`)
    const missing = await request(server()).get(`/api/probe-accounts/${MISSING}`)

    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(foreign.status)
    expect(missing.body).toStrictEqual(foreign.body)
    expect(missing.headers['content-type']).toBe(foreign.headers['content-type'])
    expect(foreign.body).toStrictEqual({ statusCode: 404, message: 'Account not found', error: 'Not Found' })
  })

  it('is found by its owner with the same setup', async () => {
    userId = USER_B

    const response = await request(server()).get(`/api/probe-accounts/${ACCOUNT_OF_B}`).expect(200)

    expect(response.body).toStrictEqual(ROWS[1])
  })

  it('never shows up in the list of another owner', async () => {
    const response = await request(server()).get('/api/probe-accounts').expect(200)

    expect(response.body).toStrictEqual([ROWS[0]])
  })
})
