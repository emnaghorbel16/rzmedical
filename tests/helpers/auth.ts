import type { Page } from '@playwright/test';

export function clearSession(page: Page) {
  return page.addInitScript(() => {
    localStorage.removeItem('rzm_token');
    localStorage.removeItem('rzm_user');
    // Some older screens still read this legacy key. Clearing it prevents a
    // test from inheriting a session from a previous browser context.
    localStorage.removeItem('token');
  });
}

export async function mockLogin(page: Page, status = 401, body = { error: 'Identifiants invalides' }) {
  await page.route('**/api/auth/login', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
}

export async function mockSuccessfulAdminLogin(page: Page) {
  await page.route('**/api/auth/login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'playwright-test-token',
      user: { id: 1, email: 'admin.e2e@example.test', prenom: 'Admin', nom: 'E2E' },
    }),
  }));
  await page.route('**/api/auth/verify-otp', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'playwright-test-token',
      user: { id: 1, email: 'admin.e2e@example.test', prenom: 'Admin', nom: 'E2E' },
    }),
  }));
}

export function authenticatedAdminSession(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem('rzm_token', 'playwright-test-token');
    localStorage.setItem('rzm_user', JSON.stringify({
      id: 1,
      email: 'admin.e2e@example.test',
      prenom: 'Admin',
      nom: 'E2E',
    }));
  });
}
