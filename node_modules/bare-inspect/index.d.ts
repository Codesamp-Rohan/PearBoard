interface InspectStylize {
  (value: string, style: keyof typeof inspect.styles): string
}

interface InspectOptions {
  colors?: boolean
  depth?: number
  breakLength?: number
  stylize?: InspectStylize
}

declare function inspect(value: unknown, opts?: InspectOptions): string

declare namespace inspect {
  export const styles: {
    bigint: string
    boolean: string
    date: string
    module: string
    name: string
    null: string
    number: string
    regexp: string
    special: string
    string: string
    symbol: string
    undefined: string
  }

  export { type InspectOptions, type InspectStylize }
}

export = inspect
