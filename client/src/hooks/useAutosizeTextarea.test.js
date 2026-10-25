import { describe, expect, it } from 'vitest'
import { singleLineHeight } from './useAutosizeTextarea'

describe('singleLineHeight', () => {
  it('is line height + padding + border (the 60px Quick Add box)', () => {
    expect(singleLineHeight({ lineHeight: '24px', paddingTop: '18px', paddingBottom: '18px', borderTopWidth: '1px', borderBottomWidth: '1px' })).toBe(62)
  })
  it('falls back to 1.5 x font size when line-height is "normal"', () => {
    expect(singleLineHeight({ lineHeight: 'normal', fontSize: '16px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' })).toBe(24)
  })
  it('never returns NaN for missing values', () => {
    expect(Number.isFinite(singleLineHeight({}))).toBe(true)
  })
})
