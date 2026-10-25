import { describe, expect, it } from 'vitest'
import { clearSession, getRefreshToken, getToken, isLoggedIn, setSession } from './auth'

describe('session storage', () => {
  it('stores and clears the access/refresh pair', () => {
    expect(isLoggedIn()).toBe(false)
    setSession({ access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 900 })
    expect(getToken()).toBe('a')
    expect(getRefreshToken()).toBe('r')
    expect(isLoggedIn()).toBe(true)

    localStorage.setItem('seenUpdatesCount', '3')
    clearSession({ keepOffline: true })
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(localStorage.getItem('seenUpdatesCount')).toBeNull()
    expect(isLoggedIn()).toBe(false)
  })

  it('keeps the old "token" key so existing components that read it keep working', () => {
    setSession({ access_token: 'a', refresh_token: 'r' })
    expect(localStorage.getItem('token')).toBe('a')
  })

  it('ignores missing fields instead of storing "undefined"', () => {
    setSession({ access_token: 'only-access' })
    expect(getRefreshToken()).toBeNull()
  })
})
