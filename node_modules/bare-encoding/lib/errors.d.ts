declare class EncodingError extends Error {
  readonly code: string

  static INVALID_LABEL(msg: string): EncodingError
}

export = EncodingError
