import { describe, expect, it } from 'vitest'

import { row, SUBJECT, useUsersService } from './setup'

describe('UsersService.upsertByExternalSubject', () => {
  const { service, upsert } = useUsersService()

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
})
