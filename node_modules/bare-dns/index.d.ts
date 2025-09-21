type IPFamily = 4 | 6

interface LookupOptions {
  family?: `IPv${IPFamily}` | IPFamily | 0
  hints?: number
  all?: boolean
}

declare class DNSResolver {
  resolveTxt(
    hostname: string,
    cb: (err: Error | null, records: string[][]) => void
  ): void

  destroy(): void
}

declare namespace dns {
  export function lookup(
    hostname: string,
    cb: (
      err: Error | null,
      address: string | null,
      family: IPFamily | 0
    ) => void
  ): void

  export function lookup(
    hostname: string,
    opts: LookupOptions & { all?: false },
    cb: (
      err: Error | null,
      address: string | null,
      family: IPFamily | 0
    ) => void
  ): void

  export function lookup(
    hostname: string,
    opts: LookupOptions & { all: true },
    cb: (
      err: Error | null,
      addresses: { address: string; family: IPFamily }[] | null
    ) => void
  ): void

  export function resolveTxt(
    hostname: string,
    cb: (err: Error | null, records: string[][]) => void
  ): void

  export { type IPFamily, type LookupOptions, DNSResolver as Resolver }
}

export = dns
