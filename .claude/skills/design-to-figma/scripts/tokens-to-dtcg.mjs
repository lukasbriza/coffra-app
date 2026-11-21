#!/usr/bin/env node
// Projects the project's tokens package into DTCG files under design/tokens/.
// One file per set, because Tokens Studio creates one Figma variable collection per
// exported token set.
//
//   node .claude/skills/design-to-figma/scripts/tokens-to-dtcg.mjs
//     [--out design/tokens] [--config design/tokens.config.json]
//
// Run from the repo root. Build the tokens package first.
//
// The token SET IS PER REPO. A project shapes packages/tokens to fit its own app, so this
// script does not hardcode export names: it reads design/tokens.config.json when present and
// otherwise falls back to the shape that templates/package-tokens ships as an example. Reshape
// your tokens, then adjust that config — never this script, which the template owns and
// sync-template will overwrite.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Matches what templates/package-tokens exposes. An example, not a contract.
const DEFAULT_CONFIG = {
  entry: 'packages/tokens/dist/index.js',
  sets: {
    color: [{ export: 'palette', type: 'color' }],
    spacing: [
      { export: 'spacing', type: 'dimension', as: 'space', steps: 12 },
      { export: 'radius', type: 'dimension' },
    ],
    typography: [
      { export: 'fontSize', type: 'dimension' },
      { export: 'fontWeight', type: 'fontWeight' },
    ],
  },
}

const flag = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const outDir = resolve(flag('out', 'design/tokens'))
const configPath = resolve(flag('config', 'design/tokens.config.json'))

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const loadConfig = async () => {
  try {
    return { config: JSON.parse(await readFile(configPath, 'utf8')), source: configPath }
  } catch (error) {
    if (error.code !== 'ENOENT') fail(`Cannot parse ${configPath}:\n  ${error.message}`)
    return { config: DEFAULT_CONFIG, source: 'built-in default (templates/package-tokens shape)' }
  }
}

const { config, source } = await loadConfig()
const entry = resolve(config.entry ?? DEFAULT_CONFIG.entry)

const tokens = await import(pathToFileURL(entry).href).catch(() =>
  fail(
    `Cannot import the tokens package at ${entry}\n` +
      `  - run from the repo root\n` +
      `  - build it:  pnpm --filter <tokens package> build\n` +
      `  - or set "entry" in ${configPath}`,
  ),
)

const LEAF = {
  color: (v) => ({ $type: 'color', $value: String(v) }),
  dimension: (v) => ({ $type: 'dimension', $value: typeof v === 'number' ? `${v}px` : String(v) }),
  number: (v) => ({ $type: 'number', $value: Number(v) }),
  fontWeight: (v) => ({ $type: 'fontWeight', $value: Number(v) }),
  fontFamily: (v) => ({ $type: 'fontFamily', $value: String(v) }),
  duration: (v) => ({ $type: 'duration', $value: typeof v === 'number' ? `${v}ms` : String(v) }),
}

const isGroup = (value) => typeof value === 'object' && value !== null

const walk = (value, leaf) =>
  isGroup(value)
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, leaf)]))
    : leaf(value)

const describeExports = () =>
  Object.entries(tokens)
    .filter(([name]) => name !== 'default')
    .map(([name, value]) => `    ${name}: ${typeof value === 'function' ? 'function' : typeof value}`)
    .join('\n')

const build = (entries) => {
  const out = {}
  for (const spec of entries) {
    const leaf = LEAF[spec.type]
    if (!leaf) fail(`Unknown type "${spec.type}" in ${configPath}. Known: ${Object.keys(LEAF).join(', ')}`)

    const value = tokens[spec.export]
    if (value === undefined) {
      fail(
        `Export "${spec.export}" is not in ${entry}.\n` +
          `  Your tokens were reshaped — adjust ${configPath}.\n` +
          `  Available exports:\n${describeExports()}`,
      )
    }

    const name = spec.as ?? spec.export

    if (spec.steps !== undefined) {
      if (typeof value !== 'function') fail(`"${spec.export}" has "steps" but is not a function.`)
      out[name] = Object.fromEntries(
        Array.from({ length: spec.steps }, (_, i) => [String(i + 1), leaf(value(i + 1))]),
      )
      continue
    }

    if (typeof value === 'function') {
      fail(`"${spec.export}" is a function — add "steps" to its entry in ${configPath}.`)
    }

    out[name] = walk(value, leaf)
  }
  return out
}

await mkdir(outDir, { recursive: true })

const written = []
for (const [setName, entries] of Object.entries(config.sets ?? {})) {
  const file = resolve(outDir, `${setName}.json`)
  await writeFile(file, `${JSON.stringify(build(entries), null, 2)}\n`, 'utf8')
  written.push(file)
}

if (written.length === 0) fail(`No sets defined in ${configPath}.`)

console.log(`Config: ${source}`)
console.log(`Wrote ${written.length} token sets:`)
written.forEach((file) => console.log(`  ${file}`))
console.log('\nNext: Tokens Studio -> Import -> these files -> Export to Figma from Token Sets.')
