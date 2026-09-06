export const HAFA_TYPESCRIPT_DECLARATIONS = `
declare const console: {
  log(...values: unknown[]): void
  info(...values: unknown[]): void
  warn(...values: unknown[]): void
  error(...values: unknown[]): void
}

declare function print(...values: unknown[]): void
`
