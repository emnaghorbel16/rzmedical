import type { Locator, Page } from '@playwright/test';

export class SignInPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByPlaceholder('admin@randzmedical.com');
    this.password = page.getByPlaceholder('Votre mot de passe');
    this.submit = page.getByRole('button', { name: /Continuer/i });
  }

  async goto() { await this.page.goto('/signin'); }
  async fillCredentials(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
  }
}
