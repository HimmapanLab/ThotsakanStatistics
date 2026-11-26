import { describe, expect, it } from 'vitest'
import { plotHeight } from './plotHeight'

describe('plotHeight', () => {
  it('keeps a 2:1 shape', () => {
    expect(plotHeight(640)).toBe(320)
    expect(plotHeight(800)).toBe(400)
  })

  it('is never under 200 px', () => {
    expect(plotHeight(300)).toBe(200)
    expect(plotHeight(0)).toBe(200)
  })

  it('is never over 480 px', () => {
    expect(plotHeight(960)).toBe(480)
    expect(plotHeight(2000)).toBe(480)
  })
})
