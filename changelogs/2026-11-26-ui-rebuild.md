# 2026-11-26: the UI rebuild (version 1.1.0)

The screens are rebuilt around the approved front-page prototype. No statistic changed: every number still comes from the backend, and the maths in `backend/core/` is untouched.

- **Shell.** One hash router (`app/routes.ts`: `#home`, `#probability`, `#statistics-graphical`, `#statistics-descriptive`, `#statistics-inference`, `#hypothesis`, `#regression`; `#preferences` opens the Preferences sheet over the current page). A top bar with a Statistics menu replaces the logo bar and sub-tab bar, and each topic page has a page head. Light theme only; the Dark choice is shown disabled in Preferences.
- **Data drawer.** Data moved out of its own tab into a rail on every topic page. The rail opens a drawer (example datasets, CSV upload, first rows with sort, column types with undo/redo, filter) that takes the place of the inputs while it is open. Display precision lives only in Preferences.
- **Front page.** A topic carousel with a scene per topic, driven by the loaded data. Linear regression shows a "Coming later" page.
- **Statistics, Hypothesis and Probability pages.** Step gating: the steps appear in order and stay open. Results update by themselves (no Run button), tables first, then plots. The right-hand notebook panel is gone: each formula is behind an ƒ button that opens a popover typeset with KaTeX, from the same TeX as before.
- **Removed.** `CommonDistNotebook`, the `NotebookSlot` exports, the old full-width `DataTab`, the collapsible `ExampleDatasets` card, and the resizable-panel pieces (`CollapsedRail`, `DragHandle`, `ResultSection`, `ResultToolbar`, `useResizablePanel`, `useSidebarKeyboard`, `useLocalStorageState`).
- **Resizable panels.** The Inputs panel and the Data drawer each have a handle on their right edge (drag, arrow keys, Home/End, double-click to reset); the widths are saved per browser and the results always keep at least 30rem. Stacked phone layouts have no handle.
- **Probability needs no data.** On Probability the Data tab is greyed out and does not open; an open drawer closes.
- **Export.** The Export button matches the Lab's buttons and names what each format holds; the PDF report now rounds every number by the display-precision rule (it wrote raw values before), while the CSV keeps every value in full.
- **Version.** 1.1.0 (new features, per the versioning decision); shown in Preferences.
- **Kept as before.** The request lifecycle (debounce, abort, stale-response guards), the shared `api/client.ts`, display precision in `utils/formatNumber.ts`, page-state and session persistence across a refresh, and the haptics module.

Tests: component tests for each new piece, `layout/EmptyStates.test.tsx` (the no-data buttons load the Electricity example and open the drawer), `layout/LabBench.test.tsx` (rail, drawer, Esc, focus).
