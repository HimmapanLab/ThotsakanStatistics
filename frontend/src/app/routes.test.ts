import { describe, expect, it } from 'vitest'
import { isPreferencesHash, ROUTES, routeFromHash, STATS_SUB } from './routes'

describe('routeFromHash', () => {
  it('names every page by its hash', () => {
    for (const route of ROUTES) expect(routeFromHash('#' + route)).toBe(route)
  })

  it('takes a hash without the #', () => {
    expect(routeFromHash('hypothesis')).toBe('hypothesis')
  })

  it('opens the first Statistics page for #statistics', () => {
    expect(routeFromHash('#statistics')).toBe('statistics-graphical')
  })

  it('goes home for an empty or unknown address', () => {
    expect(routeFromHash('')).toBe('home')
    expect(routeFromHash('#')).toBe('home')
    expect(routeFromHash('#nowhere')).toBe('home')
    expect(routeFromHash('#statistics-nope')).toBe('home')
  })

  it('goes to the given fallback instead of home', () => {
    expect(routeFromHash('#preferences', 'probability')).toBe('probability')
  })

  it('does not treat #preferences as a page', () => {
    expect(ROUTES).not.toContain('preferences')
    expect(isPreferencesHash('#preferences')).toBe(true)
    expect(isPreferencesHash('#probability')).toBe(false)
  })
})

describe('STATS_SUB', () => {
  it('lists the three Statistics pages, all of them routes', () => {
    expect(STATS_SUB).toEqual(['statistics-graphical', 'statistics-descriptive', 'statistics-inference'])
    for (const route of STATS_SUB) expect(ROUTES).toContain(route)
  })
})
