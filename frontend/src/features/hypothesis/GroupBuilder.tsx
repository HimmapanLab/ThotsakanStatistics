import { useId, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { SelectField, TextField } from '../../components/ControlPrimitives';
import type { GroupSpec } from '../../api/hypothesis';

/**
 * A group is the union of one or more selected values of one categorical column.
 * Two builders are independent, so group 1 and group 2 may name different
 * columns — that flexibility is inherited from the original Gradio app.
 *
 * A column can hold thousands of categories (a timestamp, an ID). Only LEVEL_LIST_CAP of them are listed;
 * a search box narrows the list, and "All" is off because such a group would hold one row per category.
 */
export const LEVEL_LIST_CAP = 200;

export default function GroupBuilder({
  label,
  value,
  onChange,
  categoricalCols,
  showName = true,
  sampleCount,
  describedBy,
}: {
  label: string;
  value: GroupSpec;
  onChange: (next: GroupSpec) => void;
  categoricalCols: string[];
  showName?: boolean;
  sampleCount?: number;
  describedBy?: string;
}) {
  const id = useId();
  const { getUniqueValues } = useData();
  const levels = value.column ? getUniqueValues(value.column) : [];
  const [query, setQuery] = useState('');
  const tooMany = levels.length > LEVEL_LIST_CAP;
  const selected = useMemo(() => new Set(value.values), [value.values]);
  const shown = useMemo(() => {
    if (!tooMany) return levels;
    const q = query.trim().toLowerCase();
    const matches = q ? levels.filter((level) => level.toLowerCase().includes(q)) : levels;
    return matches.slice(0, LEVEL_LIST_CAP);
  }, [levels, query, tooMany]);

  const setColumn = (column: string) => {
    // Values belong to the old column; clearing them avoids a silently empty group.
    setQuery('');
    onChange({ ...value, column, values: [] });
  };

  const toggleValue = (level: string) => {
    const next = selected.has(level)
      ? value.values.filter((v) => v !== level)
      : [...value.values, level];

    // Mirrors the Gradio app: the name follows the first selection until the
    // student types their own.
    const autoNamed = !value.name || value.name === label || value.name === value.values[0];
    const name = autoNamed ? (next[0] ?? '') : value.name;
    onChange({ ...value, values: next, name });
  };

  return (
    <fieldset className="mb-3 min-w-0 border border-[var(--color-border-md)] rounded-md overflow-hidden">
      <legend className="sr-only">{label}</legend>
      <div className="bg-[var(--color-bg-input)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] border-b border-[var(--color-border-md)] flex justify-between items-center">
        <span>{label}</span>
        <span className="text-xs font-normal text-[var(--color-text-muted)]">
          {value.values.length} selected{sampleCount !== undefined ? ` · n = ${sampleCount}` : ''}
        </span>
      </div>

      <div className="p-2.5">
        <SelectField label="Grouping column" value={value.column} onChange={setColumn} options={categoricalCols} placeholder="Select a column…" />

        {value.column && (
          <>
            <div className="flex justify-between items-center mb-1">
              <span id={id + '-values'} className="text-sm text-[var(--color-text)]">Categories</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tooMany}
                  title={tooMany ? `${levels.length} categories: pick them one by one` : undefined}
                  onClick={() => onChange({ ...value, values: levels })}
                  aria-label={`Select all categories for ${label}`}
                  className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer p-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...value, values: [] })}
                  aria-label={`Clear categories for ${label}`}
                  className="text-xs text-[var(--color-text-muted)] hover:underline cursor-pointer p-1"
                >
                  Clear
                </button>
              </div>
            </div>

            {tooMany && (
              <div className="mb-1.5">
                <p id={id + '-many'} className="text-xs text-[var(--color-text-muted)] mb-1">
                  This column has {levels.length.toLocaleString()} categories, so each one holds very few rows. Type to find
                  categories, or choose a column with fewer of them.
                </p>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={`Find categories for ${label}`}
                  aria-describedby={id + '-many'}
                  placeholder="Find a category…"
                  className="w-full rounded-md border border-[var(--color-border-md)] bg-[var(--color-bg-input)] px-2 py-1 text-sm text-[var(--color-text)]"
                />
              </div>
            )}

            <div role="group" aria-labelledby={id + '-values'} aria-describedby={describedBy} className="max-h-40 overflow-y-auto custom-scrollbar rounded-md border border-[var(--color-border-md)] bg-[var(--color-bg-base)] p-1.5 mb-2">
              {shown.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] px-1 py-0.5">No values found.</p>
              )}
              {shown.map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer px-1 py-1.5 rounded hover:bg-[var(--color-bg-hover)]">
                  <input
                    type="checkbox"
                    checked={selected.has(level)}
                    onChange={() => toggleValue(level)}
                    className="accent-[var(--color-accent)] cursor-pointer"
                  />
                  <span className="text-sm text-[var(--color-text)] break-words min-w-0">{level}</span>
                </label>
              ))}
              {tooMany && shown.length === LEVEL_LIST_CAP && (
                <p className="text-xs text-[var(--color-text-muted)] px-1 py-0.5">Showing the first {LEVEL_LIST_CAP}. Type to narrow the list.</p>
              )}
            </div>

            {showName && (
              <TextField label="Group name" value={value.name} onChange={(name) => onChange({ ...value, name })} placeholder={label} />
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}
