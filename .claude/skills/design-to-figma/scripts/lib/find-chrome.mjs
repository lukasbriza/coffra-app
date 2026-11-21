// Locates a Chromium-family browser. Shared by preflight.mjs and shoot.mjs so the candidate
// list lives in one place. CHROME_PATH always wins.

// Machine-local browser locations, not inputs of a turbo task.
/* eslint-disable turbo/no-undeclared-env-vars */

import { existsSync } from 'node:fs'
import path from 'node:path'

const windowsCandidates = () => [
  path.join(process.env['ProgramFiles'] ?? String.raw`C:\Program Files`, 'Google/Chrome/Application/chrome.exe'),
  path.join(
    process.env['ProgramFiles(x86)'] ?? String.raw`C:\Program Files (x86)`,
    'Google/Chrome/Application/chrome.exe',
  ),
  path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles'] ?? String.raw`C:\Program Files`, 'Microsoft/Edge/Application/msedge.exe'),
]

const macCandidates = () => [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

const linuxCandidates = () => [
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
  '/snap/bin/chromium',
]

const CANDIDATES_BY_PLATFORM = { win32: windowsCandidates, darwin: macCandidates }

export const chromeCandidates = () => {
  const platformCandidates = CANDIDATES_BY_PLATFORM[process.platform] ?? linuxCandidates
  return [process.env.CHROME_PATH, ...platformCandidates()].filter(Boolean)
}

export const findChrome = () => chromeCandidates().find((p) => existsSync(p)) ?? null
