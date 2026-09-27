import {describe, expect, it} from 'vitest'
import {POLICY_IDS, QUARANTINED_POLICY_IDS} from '../src/policy/assets'
import {randomPolicy, randomSeed} from '../src/policy/selection'

describe('blind checkpoint selection', () => {
  it('only ever returns a clean playtest checkpoint', () => {
    for (let value = 0; value < 256; value++) {
      const chosen = randomPolicy(() => Uint8Array.of(value))
      expect(POLICY_IDS).toContain(chosen)
      expect(QUARANTINED_POLICY_IDS).not.toContain(chosen as never)
    }
  })

  it('is unbiased across the three checkpoints', () => {
    // 255 is the only rejected byte for three options, so every accepted byte
    // maps to exactly 85 values per checkpoint.
    const counts = new Map<string, number>()
    for (let value = 0; value < 255; value++) {
      const chosen = randomPolicy(() => Uint8Array.of(value))
      counts.set(chosen, (counts.get(chosen) || 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual([...POLICY_IDS].sort())
    expect([...counts.values()]).toEqual([85, 85, 85])
  })

  it('resamples the biased tail of the byte range', () => {
    const values = [255, 255, 7]
    let index = 0
    expect(randomPolicy(() => Uint8Array.of(values[index++]))).toBe(POLICY_IDS[7 % POLICY_IDS.length])
    expect(index).toBe(3)
  })

  it('still returns a checkpoint if the sampler never yields an accepted byte', () => {
    expect(POLICY_IDS).toContain(randomPolicy(() => Uint8Array.of(255)))
  })

  it('builds a four-value uint16 simulator seed', () => {
    const seed = randomSeed(length => Uint8Array.from({length}, (_, index) => index + 1))
    expect(seed).toEqual([0x0102, 0x0304, 0x0506, 0x0708])
    expect(seed.every(value => Number.isInteger(value) && value >= 0 && value <= 65535)).toBe(true)
  })
})
