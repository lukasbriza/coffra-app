import { describe, expect, it } from 'vitest'

import { row, useUsersService } from './setup'

describe('UsersService.findById', () => {
  const { service, upsert, findUnique } = useUsersService()

  it('looks the user up by primary key only', async () => {
    const stored = row()
    findUnique.mockResolvedValue(stored)

    await expect(service.findById(stored.id)).resolves.toBe(stored)
    expect(findUnique).toHaveBeenCalledWith({ where: { id: stored.id } })
  })

  it('returns null for an unknown user', async () => {
    findUnique.mockResolvedValue(null)

    await expect(service.findById('0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a99')).resolves.toBeNull()
  })

  it('does not write anything', async () => {
    findUnique.mockResolvedValue(row())

    await service.findById('0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11')

    expect(upsert).not.toHaveBeenCalled()
  })
})
