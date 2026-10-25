import { setupServer } from 'msw/node'

// Default handlers shared by every test. Override per test with server.use(http.get(...)).
// Anything not listed here fails the test (onUnhandledRequest: 'error' in setup.js), so a
// component can never silently reach the real network.
export const handlers = []

export const server = setupServer(...handlers)
