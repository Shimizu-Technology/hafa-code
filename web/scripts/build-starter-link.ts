#!/usr/bin/env node
/**
 * Builds Hafa Code lesson starter links for CSG Learn content.
 *
 * One starter:
 *   npm --prefix web run starter-link -- --title "Expense summary" --lang python \
 *     --file expense_summary.py=../path/to/expense_summary_starter.py \
 *     --key csg-python-pilot:project \
 *     --return https://learn.codeschoolofguam.com/lessons/123 --label "Independent expense-summary project"
 *
 * Many starters (JSON in, JSON out):
 *   npm --prefix web run starter-link -- --manifest scripts/examples/csg-python-pilot-starters.json
 *
 * See docs/LEARN_STARTER_LINKS.md for the link format and limits.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildStarterLink, StarterLinkError, type StarterFile, type StarterLinkInput } from '../src/lib/starterLinks.ts'

interface ManifestFile {
  path: string
  content?: string
  /** Read the content from this file, relative to the manifest. */
  source?: string
  language?: string
}

interface ManifestStarter {
  key: string
  title: string
  kind: string
  files: ManifestFile[]
  entryPath?: string
  returnUrl?: string
  returnLabel?: string
  [extra: string]: unknown
}

interface Manifest {
  baseUrl?: string
  starters: ManifestStarter[]
}

function fail(message: string): never {
  process.stderr.write(`build-starter-link: ${message}\n`)
  process.exit(1)
}

function readFiles(files: ManifestFile[], baseDir: string): StarterFile[] {
  return files.map((file) => {
    if (typeof file.content === 'string') return { path: file.path, content: file.content, language: file.language }
    if (typeof file.source === 'string') return { path: file.path, content: readFileSync(resolve(baseDir, file.source), 'utf8'), language: file.language }
    fail(`File “${file.path}” needs "content" or "source".`)
  })
}

function build(input: StarterLinkInput) {
  try {
    return buildStarterLink(input)
  } catch (error) {
    if (error instanceof StarterLinkError) fail(error.message)
    throw error
  }
}

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' },
    title: { type: 'string' },
    lang: { type: 'string' },
    file: { type: 'string', multiple: true },
    entry: { type: 'string' },
    key: { type: 'string' },
    return: { type: 'string' },
    label: { type: 'string' },
    base: { type: 'string' },
    'allow-dev-return': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (values.help) {
  process.stdout.write(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''))
  process.exit(0)
}

if (values.manifest) {
  const manifestPath = resolve(values.manifest)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
  if (!Array.isArray(manifest.starters)) fail('The manifest needs a "starters" array.')
  const results = manifest.starters.map((starter) => {
    const { key, title, kind, files, entryPath, returnUrl, returnLabel, ...extra } = starter
    const link = build({
      title,
      kind,
      starterKey: key,
      entryPath,
      returnUrl,
      returnLabel,
      files: readFiles(files, dirname(manifestPath)),
      baseUrl: values.base ?? manifest.baseUrl,
      allowDevOrigins: values['allow-dev-return'],
    })
    return { ...extra, key, title, kind, url: link.url, length: link.length, warnings: link.warnings }
  })
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
} else {
  if (!values.title || !values.lang || !values.key || !values.file?.length) fail('Pass --title, --lang, --key, and at least one --file path[=source], or --manifest. Use --help for details.')
  const files = values.file.map((spec) => {
    const [path, source] = spec.includes('=') ? [spec.slice(0, spec.indexOf('=')), spec.slice(spec.indexOf('=') + 1)] : [spec.split('/').pop() ?? spec, spec]
    return { path, content: readFileSync(resolve(source), 'utf8') }
  })
  const link = build({
    title: values.title,
    kind: values.lang,
    starterKey: values.key,
    entryPath: values.entry,
    returnUrl: values.return,
    returnLabel: values.label,
    files,
    baseUrl: values.base,
    allowDevOrigins: values['allow-dev-return'],
  })
  for (const warning of link.warnings) process.stderr.write(`warning: ${warning}\n`)
  process.stdout.write(`${link.url}\n`)
}
