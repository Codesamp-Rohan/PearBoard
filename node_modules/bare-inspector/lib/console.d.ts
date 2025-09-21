interface DirOptions {
  colors?: number
  depth?: number
  showHidden?: boolean
}

declare class InspectorConsole {
  debug(...data: unknown[]): void
  error(...data: unknown[]): void
  info(...data: unknown[]): void
  log(...data: unknown[]): void
  warn(...data: unknown[]): void

  assert(condition: unknown, ...data: unknown[]): void
  clear(): void
  count(label?: string): void
  countReset(label?: string): void
  dir(object: unknown, opts?: DirOptions): void
  dirxml(...data: unknown[]): void
  group(...data: unknown[]): void
  groupCollapsed(...data: unknown[]): void
  groupEnd(): void
  table(data: unknown, props?: string[]): void
  time(label?: string): void
  timeEnd(label?: string): void
  timeLog(label?: string, ...data: unknown[]): void
  trace(...data: unknown[]): void

  profile(label?: string): void
  profileEnd(label?: string): void
  timeStamp(label?: string): void
}

declare namespace InspectorConsole {
  export { type DirOptions }
}

export = InspectorConsole
