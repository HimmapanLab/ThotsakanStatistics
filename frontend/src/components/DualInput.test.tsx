import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import DualInput from './DualInput'
import { useLastValid } from '../hooks/useLastValid'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function textInput() {
  return container.querySelector('input[type="text"]') as HTMLInputElement
}

function enter(value: string) {
  const input = textInput()
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function blurTextInput() {
  const input = textInput()
  act(() => {
    input.focus()
    input.blur()
  })
}

describe('DualInput', () => {
  it('cancels a pending text commit when an external value replaces it', async () => {
    const onChange = vi.fn()
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={1} onChange={onChange} />))
    enter('7')
    act(() => root.render(<DualInput label="Value" value={2} min={0} max={10} step={1} onChange={onChange} />))
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(onChange).not.toHaveBeenCalled()
    expect(textInput().value).toBe('2.00')
  })

  it('cancels a pending commit when Reset restores the same numeric value', async () => {
    const onChange = vi.fn()
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={1} resetSignal={0} onChange={onChange} />))
    enter('7')
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={1} resetSignal={1} onChange={onChange} />))
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(onChange).not.toHaveBeenCalled()
    expect(textInput().value).toBe('1.00')
  })

  it('rejects partial numeric strings and restores the last valid value on blur', () => {
    const onChange = vi.fn()
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={0.5} onChange={onChange} />))
    enter('2abc')
    expect(textInput().value).toBe('2abc')
    blurTextInput()
    expect(textInput().value).toBe('1.00')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps out-of-range text uncommitted and restores the last valid value', async () => {
    const onChange = vi.fn()
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={0.5} onChange={onChange} />))
    enter('99')
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(textInput().value).toBe('99')
    expect(onChange).not.toHaveBeenCalled()
    blurTextInput()
    expect(textInput().value).toBe('1.00')
  })

  it('rounds steps relative to a non-zero minimum', () => {
    const onChange = vi.fn()
    act(() => root.render(<DualInput label="Value" value={0.1} min={0.1} max={1} step={0.2} decimals={1} onChange={onChange} />))
    enter('0.38')
    blurTextInput()
    expect(onChange).toHaveBeenLastCalledWith(0.30000000000000004)
    expect(textInput().value).toBe('0.3')
  })

  it('says why when it takes the last valid value back, and drops the message as soon as the reader types again', () => {
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={0.5} onChange={vi.fn()} />))
    expect(container.querySelector('[id$="-error"]')).toBeNull()
    enter('99')
    blurTextInput()
    expect(textInput().value).toBe('1.00')
    expect(container.querySelector('[id$="-error"]')?.textContent).toBe('“99” is not a number from 0 to 10. Kept 1.00.')
    expect(textInput().getAttribute('aria-invalid')).toBe('true')
    enter('5')
    expect(container.querySelector('[id$="-error"]')).toBeNull()
  })

  it('says nothing when the field is left empty or the entry is accepted', () => {
    act(() => root.render(<DualInput label="Value" value={1} min={0} max={10} step={0.5} onChange={vi.fn()} />))
    enter('')
    blurTextInput()
    expect(container.querySelector('[id$="-error"]')).toBeNull()
    enter('3')
    blurTextInput()
    expect(container.querySelector('[id$="-error"]')).toBeNull()
  })

  // The Inference alpha field: the text lives in the page, and the slider follows the last valid text.
  function AlphaField() {
    const [alphaStr, setAlphaStr] = useState('0.05')
    const alpha = Number(alphaStr)
    const valid = alphaStr.trim() !== '' && Number.isFinite(alpha) && alpha > 0 && alpha < 1
    const slider = useLastValid(valid ? alpha : null, 0.05)
    return <DualInput label="Alpha" value={slider} min={0.001} max={0.5} step={0.001} decimals={3}
      onChange={(value) => setAlphaStr(value.toFixed(3))} textValue={alphaStr} onTextChange={setAlphaStr} />
  }

  it('returns an unparsable alpha to the last valid value, not to 0.05, and says so', () => {
    act(() => root.render(<AlphaField />))
    enter('0.2')
    blurTextInput()
    expect(textInput().value).toBe('0.200')
    enter('0,3')
    blurTextInput()
    expect(textInput().value).toBe('0.200')
    expect((container.querySelector('input[type="range"]') as HTMLInputElement).value).toBe('0.2')
    expect(container.querySelector('[id$="-error"]')?.textContent).toContain('Kept 0.200')
  })
})
