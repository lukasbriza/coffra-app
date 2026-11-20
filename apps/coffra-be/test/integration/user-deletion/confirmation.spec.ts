import { describe, expect, it } from 'vitest'

import { conflict } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'

/** The route that deletes the signed-in user. */
const DELETION = '/api/users/me/deletion'

// The confirmation is the stored email of the user, exactly: anything else deletes nothing.
describe('the confirmation of the deletion', () => {
  const { as, world, prisma, unchanged } = useIntegrationApp()

  it.each([
    ['the email in other letter case', (email: string) => email.toUpperCase()],
    ['the email with a space after it', (email: string) => `${email} `],
    ['a part of the email', (email: string) => email.slice(0, -1)],
  ])('refuses %s: a 409 and nothing deleted', async (_name, spell) => {
    const { a } = world()

    const response = await unchanged(() =>
      as(a)
        .post(DELETION, { confirm: spell(a.email) })
        .expect(409),
    )

    expect(response.body).toStrictEqual(conflict('Confirmation does not match the email of the user'))
  })

  it.each([
    ['no body', undefined],
    ['no confirmation', {}],
    ['an empty confirmation', { confirm: '' }],
    ['a confirmation that is a number', { confirm: 42 }],
  ])('refuses %s: a 400 and nothing deleted', async (_name, body) => {
    const { a } = world()

    await unchanged(() => as(a).post(DELETION, body).expect(400))
  })

  it('compares with the email stored now: after a change at the provider the old one no longer deletes', async () => {
    const { a } = world()
    await prisma().user.update({ where: { id: a.userId }, data: { email: 'renamed@coffra.test' } })

    await unchanged(() => as(a).post(DELETION, { confirm: a.email }).expect(409))
    await as(a).post(DELETION, { confirm: 'renamed@coffra.test' }).expect(204)
  })

  it('deletes with the exact email after a wrong attempt (control)', async () => {
    const { a } = world()
    await as(a).post(DELETION, { confirm: a.email.toUpperCase() }).expect(409)

    await as(a).post(DELETION, { confirm: a.email }).expect(204)

    expect(await prisma().user.findUnique({ where: { id: a.userId } })).toBeNull()
  })
})
