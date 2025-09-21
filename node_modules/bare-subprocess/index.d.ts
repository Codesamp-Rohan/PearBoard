import EventEmitter, { EventMap } from 'bare-events'
import Buffer from 'bare-buffer'
import Pipe from 'bare-pipe'
import constants from './lib/constants'
import errors from './lib/errors'

export { constants, errors }

export interface SubprocessEvents extends EventMap {
  exit: [code: number, signalCode: string]
}

export type IO = 'inherit' | 'pipe' | 'overlapped' | 'ignore'

export interface Subprocess<M extends SubprocessEvents = SubprocessEvents>
  extends EventEmitter<M> {
  readonly exitCode: number | null
  readonly killed: boolean
  readonly pid: number
  readonly signalCode: string | null
  readonly spawnargs: string[]
  readonly spawnfile: string
  readonly stdio: (Pipe | null)[]
  readonly stdin: Pipe | null
  readonly stdout: Pipe | null
  readonly stderr: Pipe | null

  ref(): void
  unref(): void

  kill(signum?: number): void
}

export class Subprocess {}

export interface SpawnOptions {
  cwd?: string
  stdio?: [stdin?: IO, stdout?: IO, stderr?: IO, ...fds: IO[]] | IO | null
  shell?: boolean | string
  detached?: boolean
  uid?: number
  gid?: number
  env?: Record<string, string>
  windowsHide?: boolean
  windowsVerbatimArguments?: boolean
}

export function spawn(
  file: string,
  args?: string[] | null,
  opts?: SpawnOptions
): Subprocess

export function spawn(file: string, opts?: SpawnOptions): Subprocess

export interface SpawnSyncOptions extends SpawnOptions {
  input?: string | Buffer
  maxBuffer?: number
}

export function spawnSync(
  file: string,
  args?: string[] | null,
  opts?: SpawnSyncOptions
): {
  output: (Buffer | null)[]
  pid: number
  signal: number
  status: number
  stderr: Buffer | null
  stdout: Buffer | null
}

export function spawnSync(
  file: string,
  opts?: SpawnSyncOptions
): {
  output: (Buffer | null)[]
  pid: number
  signal: number
  status: number
  stderr: Buffer | null
  stdout: Buffer | null
}
