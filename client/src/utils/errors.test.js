import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

const apiError = (status, data) => ({ request: {}, response: { status, data } })

describe('getErrorMessage', () => {
  it('returns the fallback when there is no error', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(undefined, 'custom')).toBe('custom')
  })

  it('passes plain strings through', () => {
    expect(getErrorMessage('Already a sentence')).toBe('Already a sentence')
  })

  it("uses FastAPI's string detail", () => {
    expect(getErrorMessage(apiError(422, { detail: 'Please remove the offensive language.' }))).toBe(
      'Please remove the offensive language.',
    )
  })

  it('formats a Pydantic validation list as "Field: message"', () => {
    const err = apiError(422, {
      detail: [{ loc: ['body', 'title'], msg: 'Value error, must not be empty' }],
    })
    expect(getErrorMessage(err)).toBe('Title: must not be empty')
  })

  it('maps well-known status codes when the body has no detail', () => {
    expect(getErrorMessage(apiError(401, {}))).toBe('Your session has expired. Please log in again.')
    expect(getErrorMessage(apiError(403, {}))).toBe("You don't have permission to do that.")
    expect(getErrorMessage(apiError(429, {}))).toBe('Too many attempts. Please wait a moment and try again.')
  })

  it('explains a request that never got a response', () => {
    expect(getErrorMessage({ request: {} })).toMatch(/Can't reach the server/)
  })
})
