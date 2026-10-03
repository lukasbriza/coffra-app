import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersService } from '../../../../src/modules/core/users/users.service'
import { AuthSource, PrismaService, type User } from '../../../../src/modules/prisma'

const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'

const row = (overrides: Partial<User> = {}): User => ({
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: SUBJECT,
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
  ...overrides,
})

describe('UsersService', () => {
  const upsert = vi.fn<(args: unknown) => Promise<User>>()
  const prisma = { user: { upsert } } as unknown as PrismaService
  const service = new UsersService(prisma)

  beforeEach(() => {
    upsert.mockReset()
  })

  it('looks the user up by (authSource, externalSubject) and creates it with the identity', async () => {
    upsert.mockResolvedValue(row())

    await service.upsertByExternalSubject({ subject: SUBJECT, email: 'dev@coffra.local' })

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith({
      where: { authSource_externalSubject: { authSource: 'oidc', externalSubject: SUBJECT } },
      create: { authSource: 'oidc', externalSubject: SUBJECT, email: 'dev@coffra.local' },
      update: { email: 'dev@coffra.local' },
    })
  })

  it('updates only the email, never the identity key', async () => {
    upsert.mockResolvedValue(row())

    await service.upsertByExternalSubject({ subject: SUBJECT, email: 'dev@coffra.local' })

    const { update } = upsert.mock.calls[0]?.[0] as { update: Record<string, unknown> }
    expect(Object.keys(update)).toEqual(['email'])
  })

  it('sends a changed email from the identity provider on the next login', async () => {
    upsert.mockResolvedValue(row({ email: 'new@coffra.local' }))

    const user = await service.upsertByExternalSubject({ subject: SUBJECT, email: 'new@coffra.local' })

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { email: 'new@coffra.local' } }))
    expect(user.email).toBe('new@coffra.local')
  })

  it('returns the row from the database unchanged', async () => {
    const stored = row()
    upsert.mockResolvedValue(stored)

    await expect(service.upsertByExternalSubject({ subject: SUBJECT, email: stored.email })).resolves.toBe(stored)
  })

  it('does not swallow database errors', async () => {
    upsert.mockRejectedValue(new Error('connection lost'))

    await expect(service.upsertByExternalSubject({ subject: SUBJECT, email: 'dev@coffra.local' })).rejects.toThrow(
      'connection lost',
    )
  })

  it('resolves through Nest DI (@Inject(PrismaService) works without decorator metadata)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    expect(moduleRef.get(UsersService)).toBeInstanceOf(UsersService)
  })
})
