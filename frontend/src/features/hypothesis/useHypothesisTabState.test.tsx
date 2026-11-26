import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hypothesisApi, ONE_SAMPLE_T, ONE_WAY_ANOVA, TWO_SAMPLE_T, type HypothesisResponse } from '../../api/hypothesis';
import { useHypothesisTabState, type HypothesisTabState } from './useHypothesisTabState';
import HypothesisControls from './HypothesisControls';
import { ObservationSlot } from './HypothesisTab';
import { DrawerProvider } from '../../context/DrawerContext';
import * as haptics from '../../lib/haptics';

vi.mock('react-plotly.js', () => ({ default: () => null }));

function dataFixture() {
  return {
    state: {
      status: 'ready' as const, sessionId: 'session-a', filename: 'ApneaCMKL.csv',
      dataset: { headers: ['Breath', 'Smoke'], rows: [], numericCols: ['Breath', 'Smoke'], categoricalCols: [] },
      numericCols: ['Breath', 'Smoke'], categoricalCols: [] as string[], profiles: {} as Record<string, { nUnique: number }>,
      filters: {} as Record<string, string[]>, displayPrecision: 3,
    },
    filteredRows: [{ Breath: '28', Smoke: '1' }, { Breath: '53', Smoke: '0' }],
    getUniqueValues: () => ['0', '1'],
  };
}
let data = dataFixture();
vi.mock('../../context/DataContext', () => ({ useData: () => data }));

function response(statistic = 2, alpha = 0.05): HypothesisResponse {
  return {
    test_type: ONE_SAMPLE_T, table: '[]', statistic, p_value: 0.04, alpha,
    reject: true, verdict: 'Reject H₀', h0: 'μ = 30', h1: 'μ ≠ 30', warnings: [],
    rejection_region: {
      dist: 't', dof: [24], x: [-3, 0, 3], pdf: [0.01, 0.4, 0.01], y_max: 0.4,
      x_range: [-3, 3], statistic, statistic_offscale: false, critical_values: [-1.9, 1.9],
      reject_region: [[-3, -1.9], [1.9, 3]], p_area: [[-3, -2], [2, 3]], tail: 'two-sided', reject: true,
    },
  };
}
function pending() {
  let resolve!: (value: HypothesisResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<HypothesisResponse>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let root: Root;
let container: HTMLDivElement;
let state: HypothesisTabState;
function Harness({ controls = true }: { controls?: boolean }) {
  state = useHypothesisTabState();
  return controls ? <HypothesisControls state={state} /> : null;
}
async function render(controls = true) {
  await act(async () => root.render(<DrawerProvider><Harness controls={controls} /></DrawerProvider>));
}
/** The user picks the variable (step 1); the later steps open and the first result is requested. */
async function pick(column = 'Breath') {
  await act(async () => state.setDraft({ column }));
  await advance();
}
async function setNull(value = '30') {
  await act(async () => state.setDraft({ mu0Str: value }));
}
async function advance() {
  await act(async () => vi.advanceTimersByTimeAsync(250));
}
const lastRequest = () => vi.mocked(hypothesisApi.runTest).mock.lastCall![0];

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  data = dataFixture();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(hypothesisApi, 'runTest').mockResolvedValue(response());
  await render();
  await pick();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Hypothesis student workflow', () => {
  it('greys the tests the data cannot run, says why, and refuses a touch on them', async () => {
    // Electricity-like data: one grouping column with only 2 levels, so one-way ANOVA cannot run.
    data = { ...data, state: { ...data.state, sessionId: 'session-g', categoricalCols: ['Holiday'], profiles: { Holiday: { nUnique: 2 } } } };
    const haptic = vi.spyOn(haptics, 'haptic').mockReturnValue(true);
    await render();
    await pick();
    const gated = [...container.querySelectorAll<HTMLElement>('.hp-gated')];
    expect(gated).toHaveLength(1);
    expect(gated[0].textContent).toContain('One-way ANOVA');
    expect(gated[0].textContent).toContain('Needs a Nominal or Ordinal column with 3 or more groups');
    expect(gated[0].querySelector('input')!.disabled).toBe(true);
    expect(gated[0].querySelector('button')!.textContent).toBe('Show me in Data');
    haptic.mockClear();
    await act(async () => gated[0].click());
    expect(haptic).toHaveBeenCalledWith('refuse');
    // The two-sample tests can run on 2 levels.
    const labels = [...container.querySelectorAll('.hp-opt .hp-check')].map((label) => label.textContent);
    expect(labels).toContain("Two samples Student's t-test");
  });

  it('opens with only step 1: the later steps are locked, nothing is sent, and the variable is empty', async () => {
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filename: 'new.csv' } };
    vi.mocked(hypothesisApi.runTest).mockClear();
    await render();
    expect(state.picked).toBe(false);
    expect(state.draft.column).toBe('');
    const titles = [...container.querySelectorAll('h2')].map((heading) => heading.textContent);
    expect(titles).toEqual(['Data', 'Test (opens after step 1)', 'Settings (opens after step 1)']);
    expect(container.querySelectorAll('.is-locked')).toHaveLength(2);
    expect(container.querySelector('select')!.value).toBe('');
    expect(container.textContent).not.toContain('Significance level');
    await advance();
    expect(hypothesisApi.runTest).not.toHaveBeenCalled();
  });

  it('opens steps 2 and 3 when a variable is picked, buzzes once for the unlock, and keeps them open afterwards', async () => {
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filename: 'new.csv' } };
    await render();
    const haptic = vi.spyOn(haptics, 'haptic').mockReturnValue(true);
    const select = container.querySelector('select')!;
    await act(async () => {
      select.value = 'Smoke';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(haptic).toHaveBeenCalledWith('step');
    expect(container.querySelectorAll('.is-locked')).toHaveLength(0);
    expect(container.querySelectorAll('.is-new')).toHaveLength(2);
    // Changing the variable later is not an unlock: no buzz, and the steps stay open.
    await act(async () => {
      select.value = 'Breath';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Significance level α');
    expect(container.querySelectorAll('.is-locked')).toHaveLength(0);
    await act(async () => vi.advanceTimersByTimeAsync(450));
    expect(container.querySelectorAll('.is-new')).toHaveLength(0);
  });

  it('does not animate or buzz for a variable that was already picked when the controls mounted', async () => {
    const haptic = vi.spyOn(haptics, 'haptic').mockReturnValue(true);
    await render(false);
    await render(true);
    expect(container.querySelectorAll('.is-new')).toHaveLength(0);
    expect(container.querySelectorAll('.is-locked')).toHaveLength(0);
    expect(haptic).not.toHaveBeenCalled();
  });

  it('shows the full panel without a dataset, with the variable disabled', async () => {
    data = { ...data, state: { ...data.state, status: 'idle' as never, sessionId: null as never, filename: '', dataset: null as never, numericCols: [] } };
    vi.mocked(hypothesisApi.runTest).mockClear();
    await render();
    const select = [...container.querySelectorAll('select')][0];
    expect(select.disabled).toBe(true);
    expect(container.textContent).toContain('— no dataset loaded —');
    expect(container.textContent).toContain('No data loaded');
    expect(container.textContent).toContain('Choose data to start.');
    expect([...container.querySelectorAll('h2')].map((heading) => heading.textContent?.replace(/ \(.*\)$/, ''))).toEqual(['Data', 'Test', 'Settings']);
    expect(hypothesisApi.runTest).not.toHaveBeenCalled();
  });

  it('calculates on its own once a variable is picked, with mu0 = 0 and no Run or Reveal step', async () => {
    expect(hypothesisApi.runTest).toHaveBeenCalledTimes(1);
    expect(lastRequest()).toMatchObject({ test_type: ONE_SAMPLE_T, column: 'Breath', mu0: 0, alpha: 0.05 });
    expect(state.result).not.toBeNull();
    expect(container.textContent).not.toContain('Run Test');
    expect(container.textContent).toContain('Reset to defaults');
    expect(container.textContent).toContain('Significance level α');
  });

  it('collapses a burst of changes into one request after a short pause', async () => {
    await setNull('3');
    await setNull('30');
    await act(async () => state.setDraft({ alphaStr: '0.01' }));
    expect(state.isDirty).toBe(true);
    expect(hypothesisApi.runTest).toHaveBeenCalledTimes(1);
    await advance();
    expect(hypothesisApi.runTest).toHaveBeenCalledTimes(2);
    expect(lastRequest()).toMatchObject({ mu0: 30, alpha: 0.01 });
    expect(state.isDirty).toBe(false);
  });

  it('keeps incomplete numeric text when controls unmount and return, and waits for a valid value', async () => {
    await act(async () => state.setDraft({ mu0Str: '-', alphaStr: '0.' }));
    await render(false);
    await render(true);
    expect(state.draft.mu0Str).toBe('-');
    expect(state.draft.alphaStr).toBe('0.');
    expect(Array.from(container.querySelectorAll('input[type="text"]')).map(input => (input as HTMLInputElement).value)).toEqual(['-', '0.']);
    await advance();
    expect(hypothesisApi.runTest).toHaveBeenCalledTimes(1);
    expect(state.isDirty).toBe(true);
  });

  it('explains the grouping prerequisite and sends nothing without a categorical column', async () => {
    await act(async () => state.setDraft({ testType: TWO_SAMPLE_T }));
    await advance();
    expect(container.textContent).toContain('Mark a grouping column as categorical in Data → Column Types.');
    expect(container.textContent).not.toContain('Open Column Types');
    expect(hypothesisApi.runTest).toHaveBeenCalledTimes(1);
  });

  it('pre-fills groups from the first categorical column, and keeps what the user chose', async () => {
    data = { ...data, state: { ...data.state, numericCols: ['Breath'], categoricalCols: ['Smoke'], profiles: { Smoke: { nUnique: 2 } } } as typeof data.state };
    await render();
    await act(async () => state.setDraft({ testType: TWO_SAMPLE_T }));
    expect(state.draft.group1).toMatchObject({ column: 'Smoke', values: ['0'] });
    expect(state.draft.group2).toMatchObject({ column: 'Smoke', values: ['1'] });
    await advance();
    expect(lastRequest()).toMatchObject({
      test_type: TWO_SAMPLE_T, column: 'Breath',
      group1: { column: 'Smoke', values: ['0'], name: 'Group 1' }, group2: { column: 'Smoke', values: ['1'], name: 'Group 2' },
    });
    await act(async () => state.setDraft({ group1: { column: 'Smoke', values: ['1'], name: 'Smokers' } }));
    expect(state.draft.group1).toMatchObject({ values: ['1'], name: 'Smokers' });
    await act(async () => state.setDraft({ testType: ONE_WAY_ANOVA }));
    expect(state.draft.anovaGroup).toMatchObject({ column: 'Smoke', values: ['0', '1'] });
  });

  it('lets only the newest request publish results', async () => {
    const older = pending();
    const newer = pending();
    vi.mocked(hypothesisApi.runTest).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    await setNull('31');
    await advance();
    await setNull('32');
    await advance();
    await act(async () => newer.resolve(response(3)));
    await act(async () => older.resolve(response(1)));
    expect(state.result?.statistic).toBe(3);
    expect(state.applied?.config.mu0).toBe(32);
    expect(state.isComputing).toBe(false);
  });

  it('does not let an older failure clear a newer loading status', async () => {
    const older = pending();
    const newer = pending();
    vi.mocked(hypothesisApi.runTest).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    await setNull('31');
    await advance();
    await setNull('32');
    await advance();
    await act(async () => older.reject(new Error('Old failure')));
    expect(state.error).toBeNull();
    expect(state.isComputing).toBe(true);
    await act(async () => newer.resolve(response(3)));
    expect(state.result?.statistic).toBe(3);
  });

  it('restores the defaults on Reset and calculates them again', async () => {
    const request = pending();
    vi.mocked(hypothesisApi.runTest).mockReturnValueOnce(request.promise);
    await setNull('31');
    await advance();
    await act(async () => state.handleReset());
    await act(async () => request.resolve(response(9)));
    expect(state.draft.mu0Str).toBe('0');
    expect(lastRequest()).toMatchObject({ mu0: 0 });
    expect(state.result?.statistic).not.toBe(9);
  });

  it('recalculates on filter changes and resets the draft for a new dataset', async () => {
    const request = pending();
    vi.mocked(hypothesisApi.runTest).mockReturnValueOnce(request.promise);
    await setNull('30');
    await advance();
    data = { ...data, state: { ...data.state, filters: { Smoke: ['1'] } } };
    await render();
    await act(async () => request.resolve(response(9)));
    expect(state.result?.statistic).not.toBe(9);
    expect(state.draft.mu0Str).toBe('30');
    expect(lastRequest()).toMatchObject({ mu0: 30, filters: { Smoke: ['1'] } });
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filename: 'new.csv' } };
    await render();
    expect(state.draft.mu0Str).toBe('0');
    expect(state.draft.column).toBe('');
    expect(state.picked).toBe(false);
  });

  it('retries the failed configuration without losing valid settings', async () => {
    vi.mocked(hypothesisApi.runTest).mockRejectedValueOnce(new Error('Service unavailable'));
    await setNull('35');
    await advance();
    expect(state.error).toBe('Service unavailable');
    expect(state.draft.mu0Str).toBe('35');
    await act(async () => state.handleRetry());
    expect(lastRequest().mu0).toBe(35);
    expect(state.result).not.toBeNull();
    expect(state.error).toBeNull();
  });
});

describe('Hypothesis panels', () => {
  function Slots() {
    state = useHypothesisTabState();
    return <DrawerProvider>
      <div data-panel="controls"><HypothesisControls state={state} /></div>
      <div data-panel="observation"><ObservationSlot state={state} /></div>
    </DrawerProvider>;
  }
  const panel = (name: string) => container.querySelector(`[data-panel="${name}"]`) as HTMLElement;

  it('shows backend warnings under the test result table, above the plot', async () => {
    vi.mocked(hypothesisApi.runTest).mockResolvedValue({ ...response(), warnings: ['Group 2 has n < 5'] });
    await act(async () => root.render(<Slots />));
    await pick();
    const warnings = panel('observation').querySelector('[aria-label="Warnings"]') as HTMLElement;
    expect(warnings.textContent).toContain('Group 2 has n < 5');
    expect(warnings.closest('section')?.querySelector('h3')?.textContent).toBe('Test result');
  });

  it('asks for a variable in the results until one is picked, then shows the tables before the plot', async () => {
    data = { ...data, state: { ...data.state, sessionId: 'session-b', filename: 'new.csv' } };
    await act(async () => root.render(<Slots />));
    expect(panel('observation').textContent).toContain('Pick a variable to start');
    await pick();
    expect(panel('observation').textContent).not.toContain('Pick a variable to start');
    const headings = [...panel('observation').querySelectorAll('h3')].map((heading) => heading.textContent);
    expect(headings.indexOf('Test result')).toBeGreaterThan(-1);
    expect(headings.findIndex((text) => text?.startsWith('Null distribution'))).toBeGreaterThan(headings.indexOf('Test result'));
  });

  it('dims the last result and says Updating while the next one loads, and never blanks it', async () => {
    await act(async () => root.render(<Slots />));
    await pick();
    expect(panel('observation').querySelector('.hp-out')?.className).not.toContain('is-updating');
    const next = pending();
    vi.mocked(hypothesisApi.runTest).mockReturnValueOnce(next.promise);
    await setNull('31');
    await advance();
    expect(panel('observation').querySelector('.hp-out')?.className).toContain('is-updating');
    expect(panel('observation').textContent).toContain('Updating…');
    expect(panel('observation').textContent).toContain('Test result');
    await act(async () => next.resolve(response(3)));
    expect(panel('observation').querySelector('.hp-out')?.className).not.toContain('is-updating');
  });

  it('never shows the settings-changed message or filler sentences', async () => {
    await act(async () => root.render(<Slots />));
    await pick();
    await setNull('12');
    expect(container.textContent).not.toContain('Settings changed');
    expect(panel('controls').textContent).not.toContain('Results update automatically');
    expect(panel('controls').textContent).not.toContain('Compare one population mean');
    expect(panel('observation').textContent).not.toContain('Reject');
  });
});
