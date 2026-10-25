import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../test/server'
import api, { logoutFromServer } from './api'
import { AUTH_EXPIRED_EVENT, clearSession, getRefreshToken, getToken, setSession } from './auth'

const BASE = 'http://localhost:8000/v1'
const login = (access = 'access-1', refresh = 'refresh-1') => setSession({ access_token: access, refresh_token: refresh })

describe('silent token refresh', () => {
  it('renews an expired access token once and repeats the request', async () => {
    login()
    const seen = []
    server.use(
      http.get(`${BASE}/tasks`, ({ request }) => {
        seen.push(request.headers.get('authorization'))
        return request.headers.get('authorization') === 'Bearer access-2'
          ? HttpResponse.json([{ id: 1 }])
          : HttpResponse.json({ detail: 'Could not validate credentials' }, { status: 401 })
      }),
      http.post(`${BASE}/auth/refresh`, async ({ request }) => {
        expect(await request.json()).toEqual({ refresh_token: 'refresh-1' })
        return HttpResponse.json({ access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'bearer', expires_in: 900 })
      }),
    )

    const response = await api.get('/tasks')

    expect(response.data).toEqual([{ id: 1 }])
    expect(seen).toEqual(['Bearer access-1', 'Bearer access-2'])
    expect(getToken()).toBe('access-2')
    expect(getRefreshToken()).toBe('refresh-2') // rotated: the old one is dead
  })

  it('shares ONE refresh between requests that fail at the same moment', async () => {
    login()
    let refreshCalls = 0
    server.use(
      http.get(`${BASE}/tasks`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-2'
          ? HttpResponse.json([])
          : HttpResponse.json({}, { status: 401 }),
      ),
      http.get(`${BASE}/user/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-2'
          ? HttpResponse.json({ id: 'u' })
          : HttpResponse.json({}, { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json({ access_token: 'access-2', refresh_token: 'refresh-2', token_type: 'bearer', expires_in: 900 })
      }),
    )

    const [tasks, me] = await Promise.all([api.get('/tasks'), api.get('/user/me')])

    expect(tasks.status).toBe(200)
    expect(me.status).toBe(200)
    expect(refreshCalls).toBe(1) // a second call would present a spent token and log the user out
  })

  it('signs the user out when the refresh token is refused', async () => {
    login()
    const onExpired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    server.use(
      http.get(`${BASE}/tasks`, () => HttpResponse.json({}, { status: 401 })),
      http.post(`${BASE}/auth/refresh`, () => HttpResponse.json({ detail: 'Your session has expired.' }, { status: 401 })),
    )

    await expect(api.get('/tasks')).rejects.toMatchObject({ response: { status: 401 } })

    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(onExpired).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  })

  it('does NOT sign the user out when the refresh fails only because the network is down', async () => {
    login()
    const onExpired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    server.use(
      http.get(`${BASE}/tasks`, () => HttpResponse.json({}, { status: 401 })),
      http.post(`${BASE}/auth/refresh`, () => HttpResponse.error()),
    )

    await expect(api.get('/tasks')).rejects.toBeTruthy()

    expect(getRefreshToken()).toBe('refresh-1')
    expect(onExpired).not.toHaveBeenCalled()
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  })

  it('a legacy session (access token but no refresh token) is signed out on the first 401', async () => {
    localStorage.setItem('token', 'old-long-lived-token')
    const onExpired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    server.use(http.get(`${BASE}/tasks`, () => HttpResponse.json({}, { status: 401 })))

    await expect(api.get('/tasks')).rejects.toBeTruthy()

    expect(getToken()).toBeNull()
    expect(onExpired).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  })

  it('never tries to refresh when nobody is logged in, or for the login request itself', async () => {
    let refreshCalls = 0
    server.use(
      http.get(`${BASE}/tasks`, () => HttpResponse.json({}, { status: 401 })),
      http.post(`${BASE}/auth/login`, () => HttpResponse.json({ detail: 'Incorrect email or password' }, { status: 401 })),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json({}, { status: 401 })
      }),
    )
    await expect(api.get('/tasks')).rejects.toBeTruthy()

    login()
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshCalls).toBe(0)
    expect(getToken()).toBe('access-1') // a wrong password must not log out an existing session
  })
})

describe('logoutFromServer', () => {
  it('sends the refresh token to /auth/logout and never throws', async () => {
    login()
    let body
    server.use(
      http.post(`${BASE}/auth/logout`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ message: 'Logged out.' })
      }),
    )
    await logoutFromServer()
    expect(body).toEqual({ refresh_token: 'refresh-1' })

    server.use(http.post(`${BASE}/auth/logout`, () => HttpResponse.error()))
    await expect(logoutFromServer()).resolves.toBeUndefined()
  })

  it('does nothing without a refresh token', async () => {
    clearSession({ keepOffline: true })
    await expect(logoutFromServer()).resolves.toBeUndefined() // would fail the test on an unhandled request
  })
})
