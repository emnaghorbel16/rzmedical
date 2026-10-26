import { test, expect } from '../../fixtures/test-fixtures';
import { clearSession, mockLogin, mockSuccessfulAdminLogin } from '../../helpers/auth';
import { SignInPage } from '../../pages/sign-in.page';

test.describe('Authentification admin', () => {
  test('affiche la page de connexion et exige les champs obligatoires', async ({ page }) => {
    await clearSession(page);
    const signIn = new SignInPage(page);
    await signIn.goto();
    await expect(page.getByRole('heading', { name: 'Connexion Admin' })).toBeVisible();
    await expect(signIn.email).toBeVisible();
    await expect(signIn.password).toBeVisible();
    await expect(signIn.email).toHaveAttribute('required', '');
    await expect(signIn.password).toHaveAttribute('required', '');
  });

  test('affiche une erreur avec des identifiants invalides', async ({ page }) => {
    await clearSession(page);
    await mockLogin(page);
    const signIn = new SignInPage(page);
    await signIn.goto();
    await signIn.fillCredentials('inexistant@example.test', 'mot-de-passe-invalide');
    await signIn.submit.click();
    await expect(page.getByText('Identifiants invalides')).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('connecte l’administrateur et ouvre le tableau de bord', async ({ page }) => {
    await clearSession(page);
    await mockSuccessfulAdminLogin(page);
    const signIn = new SignInPage(page);
    await signIn.goto();
    await signIn.fillCredentials('admin.e2e@example.test', 'mot-de-passe-de-test');
    await signIn.submit.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Tableau de Bord' })).toBeVisible();
  });
});
