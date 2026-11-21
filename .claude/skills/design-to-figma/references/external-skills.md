# External tools — what to take, what to ignore

These are **dependencies, not copies**. Do not vendor them into this repo: they version and
update on their own, and `sync-template`'s 3-way merge would fight every upstream change.
Install per project, commit nothing, keep the pins in this table honest.

The `.gitignore` already excludes the install directories.

Check what is present before the pipeline starts, rather than discovering it in phase 3:

```bash
node .claude/skills/design-to-figma/scripts/preflight.mjs
```

## Pins

An **app screen needs nothing installed.** Everything the pipeline needs either runs from
`pnpm dlx` or uses what is already on the machine.

| Tool | Install | Licence | Role |
|---|---|---|---|
| impeccable detector | **nothing** — `pnpm dlx impeccable detect` | Apache-2.0 | the phase 3 gate |
| designlang | `pnpm dlx designlang install-browser` once | MIT | reference extraction + brand check |
| `shoot.mjs` | **nothing** — ours, drives the installed Chromium | — | phase 3 screenshots |
| html2figma | Figma Community plugin | free, unlimited | HTML → native layers |
| Tokens Studio | Figma Community plugin | free licence | DTCG → Figma variables |
| taste-skill | see below | MIT | **landing pages only** |

Re-run the same command to update. Record a breaking change here when one bites.

## There is no generator for app screens

This was a deliberate change after reading what the installed taste-skill actually is. The form
of an app screen is dealt by procedure — `references/directions.md` — not by a tool, because the
part that prevents slop is the facts, and no external skill can read this repo's contract.

For a dense data screen the layout is largely dictated by what the screen must show. Style
matters far less than it does for a hero section, which is exactly where the skill ecosystem is
concentrated.

## taste-skill — landing pages, not app screens

Version 2.5.x builds **company and product websites**. Its own description names landing, company,
product, shop, cafe, hotel, studio, SaaS, AI, developer-tool and game sites; its page kinds are
`software`, `product`, `service`, `place`, `gaming`, `tech`; its references are sections, copy
voice, photographs, effects and scenes. There is no app-screens reference in it, and the one
mention of product UI is a mockup inside a marketing hero — *"never a generic dashboard"*.

So it designs the page that sells the app, not the app. Full pass: `references/landing-page.md`.

```bash
pnpm dlx skills add https://github.com/Leonxlnx/taste-skill \
  --skill "design-taste-frontend" --agent claude-code --copy --rename taste-skill -y
```

`--rename taste-skill` gives the folder the name `.gitignore` excludes. Install the single skill,
not the whole collection — the repo also ships image-generation and legacy style skills.

Its real scripts are `start.mjs` (deals palettes and type pairings), `gate.mjs` (start and finish
gates), `consistency.mjs` (five widths), `copy-lint.mjs`, `perf.mjs`, `shoot.mjs`, `moments.mjs`,
`photos.mjs`, `icons.mjs`, `effects.mjs`. **There is no `inspect.mjs`** — an earlier version of
this file said there was, taken from its web guide rather than from the installed skill. Follow
its own `SKILL.md`; it is authoritative and more detailed than anything worth copying here.

Needs Node 22+, a Chromium-family browser or `CHROME_PATH`, and network access for its asset
fetching. `ffmpeg` on PATH is optional. The kit is tens of megabytes of photographs and icons,
which is why it is a gitignored dependency and never vendored.

## impeccable — detector only

Take `pnpm dlx impeccable detect`: a deterministic rule set that runs in code with no LLM and no API
key. Cheap, repeatable, and it belongs in phase 3's gate.

**Do not** use its commands or its skill. It is a complete orchestrator with its own direction
dealing and its own context files, so running it alongside taste-skill means two pipelines
competing over the same decisions and paying twice for them.

**Do not run `pnpm dlx impeccable install`.** Verified: the detector runs straight from pnpm dlx with
nothing installed.

```bash
pnpm dlx impeccable detect <file|folder|URL> [--json]
```

Tested against a deliberately bad screen; it returned `low-contrast` and `italic-serif-display`
findings with file, severity, category and snippet. `--json` writes the structured form to stdout
and pnpm's progress lines to stderr, so `2>/dev/null` leaves parseable JSON.

**The exit code is the gate**: 0 on a clean file, non-zero when it finds something. Measured both
ways, against a clean screen and a deliberately bad one.

**Never read that status through a pipe.** `detect … | head` reports `head`'s status, which is
always 0. That mistake made an earlier version of this file claim the detector always exits 0 —
it does not, and a gate built on that belief passes everything.

**WCAG AA contrast is covered.** The `low-contrast` rule reports the measured ratio against the
4.5:1 body and 3:1 large-text thresholds. No separate contrast check is needed.

Skipping the install also skips what it would have written: a project install puts the skill in
`.claude/skills/impeccable/`, four subagents in `.claude/agents/` and a PostToolUse + Stop hook
in `settings.local.json`. That hook runs after each UI edit, which contradicts this repo's rule
that linting stays at commit time. And with no install there is no telemetry and no remote roll
call to opt out of.

## designlang — reference extraction and verification

Two uses, both optional but both cheap:

- `pnpm dlx designlang <url>` reads a reference site in a real browser and reports its colours,
  type, spacing, radii, shadows and motion. Raw material for phase 1 — never the design itself.
  Requires Node 20+. It drives Chromium through Playwright, so run
  `pnpm dlx designlang install-browser` **once** — without it the tool falls back to an installed
  Chrome, which may not be there.
- It can also write agent rules of its own, including `.claude/skills/designlang/SKILL.md`.
  Do not keep that file; it would collide with this skill's scope. `.gitignore` excludes it.
- `pnpm dlx designlang verify-ui localhost:4321/<name>.html --brand design/DESIGN.md` checks a built screen
  against the recorded direction and scores how generic it reads. Part of phase 3.

`verify-ui` takes a URL, which is why phase 3 serves the screens — with `python3 -m http.server`,
because `pnpm dlx serve` answers `301` on a `.html` path and redirects to the extensionless one.

It can also emit W3C DTCG tokens, which overlaps with our own export script. Prefer the script:
it reads the project's tokens package, so the code stays the source of truth rather than a scrape.

Do not install its generated `SKILL.md` — it would collide with this skill's scope.

## Deliberately excluded

| Tool | Why not |
|---|---|
| React Bits | animated decorative components; no Figma representation, and wrong for dense data screens |
| GSAP skills | runtime motion only; nothing to export. Worth adding for a scroll-driven marketing page, in phase 5 |
| transitions.dev | same — belongs in phase 5 and is the better default for app UI than GSAP |
| Figma MCP | on a Starter plan read and write tools share a 6-call monthly limit |
| html.to.design | 10 free imports, then 10 a month |
| html2design | paid subscription |

Phase 5 motion is a separate concern on purpose. A transition has no representation in a Figma
frame, so pulling it into the design pipeline adds tokens and tool calls without changing the
deliverable.

## When to reconsider paying

Figma Professional with a Full seat unlocks variable modes, published libraries, Dev Mode and
agent-driven canvas writes. Worth it only once light **and** dark are both in scope, or someone
other than you edits the Figma file.
