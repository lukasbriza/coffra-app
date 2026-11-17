import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { EXPORT_ENV } from '../../scripts/openapi/constants'

const ENV_EXAMPLE_FILE = path.join(__dirname, '..', '..', '.env.example')

/**
 * Reads the variable names a dotenv file assigns (`NAME=value`), skipping comments and empty lines.
 *
 * @param text - the content of the file
 * @returns the names in the order of the file
 */
const variablesOfEnvFile = (text: string): string[] =>
  text.split(/\r?\n/).flatMap((line) => {
    const name = /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1]

    return name === undefined ? [] : [name]
  })

describe('.env.example', () => {
  const assigned = variablesOfEnvFile(readFileSync(ENV_EXAMPLE_FILE, 'utf8'))
  const variables = Object.keys(EXPORT_ENV)

  it('assigns every variable the app validates', () => {
    expect(variables.filter((name) => !assigned.includes(name))).toEqual([])
  })

  it('assigns no variable the app does not read', () => {
    expect(assigned.filter((name) => !variables.includes(name))).toEqual([])
  })

  it('assigns each variable once', () => {
    expect(assigned).toHaveLength(new Set(assigned).size)
  })
})
