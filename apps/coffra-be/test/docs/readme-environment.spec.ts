import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { EXPORT_ENV } from '../../scripts/openapi/constants'

const README_FILE = path.join(__dirname, '..', '..', 'README.md')

/** The heading of the README section whose table lists the environment variables. */
const SECTION_HEADING = '## Configuration'

/**
 * Reads the variable names from the first column of the table rows in one section of a Markdown document.
 *
 * @param markdown - the whole document
 * @param heading - the heading line that opens the section
 * @returns the names in the order of the rows
 * @throws Error when the document has no such heading
 */
const variablesOfSection = (markdown: string, heading: string): string[] => {
  const lines = markdown.split(/\r?\n/)
  const start = lines.indexOf(heading)

  if (start === -1) {
    throw new Error(`README.md has no section "${heading}"`)
  }

  const next = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const section = lines.slice(start + 1, next === -1 ? undefined : next)

  return section.flatMap((line) => {
    const name = /^\| `([A-Z][A-Z0-9_]*)` +\|/.exec(line)?.[1]

    return name === undefined ? [] : [name]
  })
}

describe('the environment table of the README', () => {
  const documented = variablesOfSection(readFileSync(README_FILE, 'utf8'), SECTION_HEADING)
  const variables = Object.keys(EXPORT_ENV)

  it('has a row for every variable the app validates', () => {
    expect(variables.filter((name) => !documented.includes(name))).toEqual([])
  })

  it('has no row for a variable the app does not read', () => {
    expect(documented.filter((name) => !variables.includes(name))).toEqual([])
  })

  it('lists each variable once', () => {
    expect(documented).toHaveLength(new Set(documented).size)
  })
})
