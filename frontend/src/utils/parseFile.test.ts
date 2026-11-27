import { describe, expect, it } from 'vitest'
import { MSG_HEADER_ONLY, MSG_NOT_UTF8, MSG_NO_COLUMNS, MSG_WRONG_DELIMITER, parseFile, uniqueValues } from './parseFile'

describe('parseFile', () => {
  it('accepts only .csv files, like the server', async () => {
    for (const name of ['data.tsv', 'data.txt']) {
      await expect(parseFile(new File(['a\tb\n1\t2\n'], name))).rejects.toThrow('Only CSV files are supported')
    }
  })

  it('splits on commas only, so it sees the same columns as the server', async () => {
    const dataset = await parseFile(new File(['a\tb\n1\t2\n'], 'tabs.csv'))
    expect(dataset.headers).toEqual(['a\tb'])
  })
})

const csv = (text: string, name = 'data.csv') => new File([text], name)

describe('column names match pandas, which the server reads the file with', () => {
  // Expected names were produced by pandas.read_csv (2.3) on the same header line.
  it.each([
    ['x,x,y', ['x', 'x.1', 'y']],
    ['x,x,x', ['x', 'x.1', 'x.2']],
    ['x,x.1,x', ['x', 'x.1', 'x.2']],
    ['x.1,x,x', ['x.1', 'x', 'x.2']],
    ['x,x.1,x,x', ['x', 'x.1', 'x.2', 'x.3']],
    ['x,,y,', ['x', 'Unnamed: 1', 'y', 'Unnamed: 3']],
    ['a,,Unnamed: 1', ['a', 'Unnamed: 1.1', 'Unnamed: 1']],
    ['x,,x,', ['x', 'Unnamed: 1', 'x.1', 'Unnamed: 3']],
  ])('names the header "%s" like pandas', async (header, names) => {
    const width = header.split(',').length
    const dataset = await parseFile(csv(`${header}\n${Array(width).fill('1').join(',')}\n`))
    expect(dataset.headers).toEqual(names)
    expect(Object.keys(dataset.rows[0])).toEqual(names)
  })

  it('keeps each repeated column its own values', async () => {
    const dataset = await parseFile(csv('x,x,y\n1,2,3\n4,5,6\n'))
    expect(dataset.rows).toEqual([{ x: '1', 'x.1': '2', y: '3' }, { x: '4', 'x.1': '5', y: '6' }])
  })

  it('gives a column with an empty header a name that can be picked', async () => {
    const dataset = await parseFile(csv(',score\n1,2.5\n2,3.5\n3,4.5\n'))
    expect(dataset.headers).toEqual(['Unnamed: 0', 'score'])
    expect(dataset.headers.every((name) => name !== '')).toBe(true)
    expect(dataset.numericCols).toContain('Unnamed: 0')
  })
})

describe('missing values match pandas', () => {
  it('does not offer a missing spelling as a group level', () => {
    const rows = ['A', 'NA', 'N/A', 'NaN', 'nan', 'null', 'NULL', 'None', '#N/A', '-NaN', 'n/a', '<NA>', '', 'B'].map((g) => ({ g }))
    expect(uniqueValues(rows, 'g')).toEqual(['A', 'B'])
  })

  it('keeps what pandas keeps as a value: "?", " NA", "none" and "Null"', () => {
    const rows = ['?', ' NA', 'none', 'Null', 'A'].map((g) => ({ g }))
    expect(uniqueValues(rows, 'g')).toEqual([' NA', '?', 'A', 'Null', 'none'])
  })

  it('types a numeric column with 25% "N/A" as numeric', async () => {
    const dataset = await parseFile(csv('y\n1.5\n2.5\n3.5\nN/A\n1.7\n2.7\n3.7\nN/A\n'))
    expect(dataset.profiles!.y.filled).toBe(6)
    expect(dataset.numericCols).toEqual(['y'])
  })
})

describe('upload messages', () => {
  it('says what to do about an empty file or one with no columns', async () => {
    for (const text of ['', '   ', '\n\n']) {
      await expect(parseFile(csv(text))).rejects.toThrow(MSG_NO_COLUMNS)
    }
    expect(MSG_NO_COLUMNS).toBe('This file has no columns. Check it is a CSV with a header row.')
  })

  it('says what to do about a file that is not UTF-8 text', async () => {
    // 0xF5 is not valid UTF-8, so the reader puts a replacement character there (the server refuses it too).
    const bytes = new Uint8Array([0x61, 0x2c, 0x62, 0x0a, 0xf5, 0x2c, 0x31, 0x0a])
    await expect(parseFile(new File([bytes], 'latin.csv'))).rejects.toThrow(MSG_NOT_UTF8)
    expect(MSG_NOT_UTF8).toBe("This file isn't UTF-8 text. In Excel, save it as 'CSV UTF-8'.")
  })

  it('warns after loading when a single column holds semicolons or tabs', async () => {
    expect((await parseFile(csv('a;b;c\n1;2.5;g\n2;3.5;h\n'))).warning).toBe(MSG_WRONG_DELIMITER)
    expect((await parseFile(csv('a\tb\n1\t2\n'))).warning).toBe(MSG_WRONG_DELIMITER)
  })

  it('warns after loading a header-only file', async () => {
    const dataset = await parseFile(csv('a,b,c\n'))
    expect(dataset.headers).toEqual(['a', 'b', 'c'])
    expect(dataset.rows).toHaveLength(0)
    expect(dataset.warning).toBe(MSG_HEADER_ONLY)
  })

  it('does not warn about a normal file', async () => {
    expect((await parseFile(csv('a,b\n1,2\n'))).warning).toBeUndefined()
  })
})
