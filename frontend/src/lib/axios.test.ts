import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { api } from './axios';

// `refreshAccessToken()` in axios.ts calls the bare `axios.post(...)` (not the `api` instance),
// so the refresh endpoint needs its own mock adapter on the default axios export.
const apiMock = new MockAdapter(api);
const rawAxiosMock = new MockAdapter(axios);

function setLocation(pathname: string) {
  // jsdom throws "Not implemented: navigation" on a real `window.location.href =` assignment;
  // stub it out so the interceptor's redirect-on-failed-refresh path is testable.
  delete (window as unknown as { location?: unknown }).location;
  (window as unknown as { location: { pathname: string; href: string } }).location = {
    pathname,
    href: '',
  };
}

beforeEach(() => {
  apiMock.reset();
  rawAxiosMock.reset();
  localStorage.clear();
  setLocation('/workspaces');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request interceptor', () => {
  it('attaches the stored access token as a Bearer header', async () => {
    localStorage.setItem('accessToken', 'token-abc');
    apiMock.onGet('/workspaces').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer token-abc');
      return [200, { success: true, data: [] }];
    });

    await api.get('/workspaces');
  });

  it('sends no Authorization header when nothing is stored', async () => {
    apiMock.onGet('/workspaces').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { success: true, data: [] }];
    });

    await api.get('/workspaces');
  });
});

describe('401 handling on protected endpoints', () => {
  it('refreshes the token once and retries the original request', async () => {
    localStorage.setItem('accessToken', 'stale-token');
    localStorage.setItem('refreshToken', 'refresh-token');

    let calls = 0;
    apiMock.onGet('/workspaces').reply(() => {
      calls += 1;
      if (calls === 1) return [401, { success: false, message: 'Unauthorized' }];
      return [200, { success: true, data: ['ok'] }];
    });
    rawAxiosMock.onPost(/\/auth\/refresh$/).reply(200, {
      success: true,
      data: { accessToken: 'fresh-token', refreshToken: 'fresh-refresh-token' },
    });

    const res = await api.get('/workspaces');

    expect(res.data.data).toEqual(['ok']);
    expect(calls).toBe(2);
    expect(localStorage.getItem('accessToken')).toBe('fresh-token');
    expect(localStorage.getItem('refreshToken')).toBe('fresh-refresh-token');
  });

  // Regression coverage for the 2026-07-02 race-condition fix: concurrent 401s used to each
  // independently POST /auth/refresh with the same (soon-to-be-consumed) refresh token — the
  // loser's request would fail, wiping out the tokens the winner had just obtained.
  it('shares a single in-flight refresh call across concurrent 401s', async () => {
    localStorage.setItem('accessToken', 'stale-token');
    localStorage.setItem('refreshToken', 'refresh-token');

    let workspaceCalls = 0;
    apiMock.onGet('/workspaces').reply(() => {
      workspaceCalls += 1;
      return workspaceCalls <= 1 ? [401, {}] : [200, { success: true, data: [] }];
    });
    let notificationCalls = 0;
    apiMock.onGet('/notifications').reply(() => {
      notificationCalls += 1;
      return notificationCalls <= 1 ? [401, {}] : [200, { success: true, data: [] }];
    });

    let refreshCallCount = 0;
    rawAxiosMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCallCount += 1;
      return [
        200,
        {
          success: true,
          data: { accessToken: 'fresh-token', refreshToken: 'fresh-refresh-token' },
        },
      ];
    });

    await Promise.all([api.get('/workspaces'), api.get('/notifications')]);

    expect(refreshCallCount).toBe(1);
  });

  it('clears tokens and redirects to /login when the refresh call itself fails', async () => {
    localStorage.setItem('accessToken', 'stale-token');
    localStorage.setItem('refreshToken', 'dead-refresh-token');

    apiMock.onGet('/workspaces').reply(401, {});
    rawAxiosMock
      .onPost(/\/auth\/refresh$/)
      .reply(401, { success: false, message: 'Invalid or expired refresh token' });

    await expect(api.get('/workspaces')).rejects.toBeTruthy();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});

// Regression coverage for the 2026-07-02 bug: a wrong password legitimately 401s on /auth/login,
// but the interceptor used to treat that like any other 401 — attempting a nonsensical refresh,
// which then failed and hard-redirected to /login, wiping the form before the real "Invalid
// credentials" message could ever render.
describe('auth endpoints are excluded from the refresh-retry flow', () => {
  it('does not attempt a refresh for a 401 from /auth/login', async () => {
    localStorage.setItem('refreshToken', 'some-refresh-token');
    apiMock
      .onPost('/auth/login')
      .reply(401, { success: false, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

    await expect(
      api.post('/auth/login', { email: 'a@a.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(
      rawAxiosMock.history.post.filter((r) => /\/auth\/refresh$/.test(r.url ?? '')),
    ).toHaveLength(0);
    // Crucially: no hard redirect either, so the real error can render on the login form.
    expect(window.location.href).toBe('');
  });
});
