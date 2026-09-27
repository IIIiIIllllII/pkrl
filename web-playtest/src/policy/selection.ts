import {POLICY_IDS, type PolicyId} from './assets'

/** Uniform random bytes; overridable so tests can drive the sampler directly. */
export type RandomBytes = (length: number) => Uint8Array

const browserBytes: RandomBytes = length => crypto.getRandomValues(new Uint8Array(length))

/**
 * Pick a blind checkpoint without modulo bias: values in the final, short
 * bucket of the byte range are rejected and resampled.
 */
export function randomPolicy(bytes: RandomBytes = browserBytes): PolicyId {
  const count = POLICY_IDS.length
  const limit = 256 - (256 % count)
  for (let attempt = 0; attempt < 64; attempt++) {
    const value = bytes(1)[0]
    if (value < limit) return POLICY_IDS[value % count]
  }
  return POLICY_IDS[count - 1]
}

export function randomSeed(bytes: RandomBytes = browserBytes): [number, number, number, number] {
  const raw = bytes(8)
  const values: number[] = []
  for (let index = 0; index < 4; index++) values.push((raw[index * 2] << 8) | raw[index * 2 + 1])
  return values as [number, number, number, number]
}
