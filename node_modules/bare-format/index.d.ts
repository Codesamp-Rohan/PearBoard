declare function format(...args: unknown[]): string

declare namespace format {
  export function format(...args: unknown[]): string

  export function formatWithOptions(opts: {}, ...args: unknown[]): string
}

export = format
