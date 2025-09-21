declare class HTTPError extends Error {
  constructor(msg: string, code: string, fn: Error)

  static NOT_IMPLEMENTED(msg?: string): HTTPError
  static CONNECTION_LOST(msg?: string): HTTPError
}

export = HTTPError
