// lib/pageState.ts
// Each topic's inputs (variable, options, steps), kept per browser so a refresh brings the page back as it was.
// Saved together with the dataset they belong to: a different dataset starts every topic afresh.
// Probability does not depend on the data and is saved under the key "*".

import { useEffect } from 'react'

export const PAGE_STATE_KEY = 'thotsakan-page-state'

export type Topic = 'graphical' | 'descriptive' | 'inference' | 'hypothesis' | 'probability'

interface Stored {
  dataset: string
  topics: Partial<Record<Topic, unknown>>
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(PAGE_STATE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Stored
    return value && typeof value === 'object' && value.topics && typeof value.topics === 'object' ? value : null
  } catch {
    return null
  }
}

/** The saved inputs of a topic for this dataset, or null. Callers check the shape before using it. */
export function loadPageState<T>(topic: Topic, dataset: string): Partial<T> | null {
  const stored = read()
  if (!stored) return null
  if (topic !== 'probability' && stored.dataset !== dataset) return null
  const value = stored.topics[topic]
  return value && typeof value === 'object' ? (value as Partial<T>) : null
}

export function savePageState(topic: Topic, dataset: string, value: unknown): void {
  try {
    const stored = read()
    const next: Stored = topic === 'probability'
      // Probability belongs to no dataset: leave the others as they are.
      ? { dataset: stored?.dataset ?? '', topics: { ...stored?.topics, probability: value } }
      : {
          dataset,
          topics: { ...(stored && stored.dataset === dataset ? stored.topics : { probability: stored?.topics.probability }), [topic]: value },
        }
    localStorage.setItem(PAGE_STATE_KEY, JSON.stringify(next))
  } catch { /* nothing kept */ }
}

/** Save `value` whenever it changes, while `dataset` names loaded data (or always, for probability). */
export function useSavePageState(topic: Topic, dataset: string, value: unknown): void {
  const json = JSON.stringify(value)
  useEffect(() => {
    if (topic !== 'probability' && !dataset) return
    savePageState(topic, dataset, JSON.parse(json))
  }, [topic, dataset, json])
}
