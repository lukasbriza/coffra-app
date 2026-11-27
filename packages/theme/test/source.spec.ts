import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.join(import.meta.dirname, '../src')

const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file))

describe('source', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s has no bare hex colour (colours come from the tokens)', (file) => {
    expect(readFileSync(path.join(SRC, file), 'utf8')).not.toMatch(/#[\da-f]{3,8}\b/i)
  })
})
