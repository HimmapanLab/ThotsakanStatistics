import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectField, TextField } from '../../components/ControlPrimitives'
import GroupBuilder, { LEVEL_LIST_CAP } from './GroupBuilder'

const manyLevels = Array.from({ length: 17518 }, (_, i) => `t${String(i).padStart(5, '0')}`)
vi.mock('../../context/DataContext', () => ({
  useData: () => ({ getUniqueValues: (column: string) => (column === 'ds' ? manyLevels : ['0', '1']) }),
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('GroupBuilder', () => {
  it('uses the shared select and text field', () => {
    act(() => root.render(<>
      <div data-part="group"><GroupBuilder label="Group 1" value={{ column: 'Smoke', values: ['0'], name: 'Group 1' }} onChange={() => {}} categoricalCols={['Smoke']} /></div>
      <div data-part="shared"><SelectField label="x" value="" onChange={() => {}} options={[]} /><TextField label="y" value="" onChange={() => {}} /></div>
    </>))
    const part = (name: string) => container.querySelector(`[data-part="${name}"]`) as HTMLElement
    expect(part('group').querySelector('select')?.className).toBe(part('shared').querySelector('select')?.className)
    expect(part('group').querySelector('input[type="text"]')?.className).toBe(part('shared').querySelector('input[type="text"]')?.className)
  })

  it('changing the column clears the selected categories', () => {
    const onChange = vi.fn()
    act(() => root.render(<GroupBuilder label="Group 1" value={{ column: 'Smoke', values: ['0'], name: 'Group 1' }} onChange={onChange} categoricalCols={['Smoke', 'Sex']} />))
    const select = container.querySelector('select') as HTMLSelectElement
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'Sex')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith({ column: 'Sex', values: [], name: 'Group 1' })
  })

  it('lists at most LEVEL_LIST_CAP categories of a near-unique column, with search and no "All"', () => {
    act(() => root.render(<GroupBuilder label="Group 1" value={{ column: 'ds', values: [], name: 'Group 1' }} onChange={() => {}} categoricalCols={['ds']} />))
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(LEVEL_LIST_CAP)
    const all = container.querySelector('button[aria-label^="Select all"]') as HTMLButtonElement
    expect(all.disabled).toBe(true)
    const search = container.querySelector('input[type="search"]') as HTMLInputElement
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 't17517')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const boxes = container.querySelectorAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(1)
    expect(boxes[0].closest('label')?.textContent).toContain('t17517')
  })

  it('lists every category and keeps "All" when there are few', () => {
    act(() => root.render(<GroupBuilder label="Group 1" value={{ column: 'Smoke', values: [], name: 'Group 1' }} onChange={() => {}} categoricalCols={['Smoke']} />))
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    expect(container.querySelector('input[type="search"]')).toBeNull()
  })
})
