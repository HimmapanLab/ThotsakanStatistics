import { describe, expect, it } from 'vitest'
import { loadPageState, savePageState } from './pageState'

describe('page state', () => {
  it('brings back a topic’s inputs for the same dataset only', () => {
    savePageState('graphical', 'Howell.csv', { cfg: { column: 'height' } })
    expect(loadPageState('graphical', 'Howell.csv')).toEqual({ cfg: { column: 'height' } })
    expect(loadPageState('graphical', 'WHR.csv')).toBeNull()
  })
  it('starts every data topic afresh with a new dataset, but keeps Probability', () => {
    savePageState('probability', '*', { distName: 'Poisson' })
    savePageState('descriptive', 'Howell.csv', { column: 'height' })
    savePageState('hypothesis', 'WHR.csv', { column: 'Life Ladder' })
    expect(loadPageState('descriptive', 'WHR.csv')).toBeNull()
    expect(loadPageState('hypothesis', 'WHR.csv')).toEqual({ column: 'Life Ladder' })
    expect(loadPageState('probability', 'anything')).toEqual({ distName: 'Poisson' })
  })
  it('saving Probability does not forget the data topics', () => {
    savePageState('inference', 'Howell.csv', { column: 'weight' })
    savePageState('probability', '*', { distName: 'Normal' })
    expect(loadPageState('inference', 'Howell.csv')).toEqual({ column: 'weight' })
  })
})
