# Tests E2E RZMedical

Les smoke tests utilisent des réponses API déterministes côté navigateur : ils testent les parcours et composants du panneau d'administration sans lire ni écrire la base PostgreSQL. Ils ciblent Next.js (`admin-panel`, port `3001`) et l'API Express attendue est `http://127.0.0.1:4000/api`.

## Commandes

```powershell
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
npm run test:e2e:report
```

`playwright.config.ts` démarre automatiquement le panneau d'administration. Pour viser une instance déjà lancée, définir `PLAYWRIGHT_NO_WEBSERVER=1` et, si nécessaire, `PLAYWRIGHT_BASE_URL`.

## Base de données et mutations

Les tests qui créent un produit, une entrée/sortie de stock, un BL, un retour, une facture ou un inventaire doivent uniquement tourner avec une base PostgreSQL isolée. Ne jamais fournir la `DATABASE_URL` de production. Le garde-fou exige :

```powershell
$env:PLAYWRIGHT_E2E_MUTATIONS='1'
$env:PLAYWRIGHT_TEST_DATABASE_URL='postgresql://.../rzmedical_test?schema=public'
```

La suite dédiée doit créer ses propres données via les endpoints documentés, préfixées `E2E-`, puis les nettoyer dans `afterEach`. Elle ne doit pas dépendre d'une donnée issue d'un autre test.

## Couverture actuelle

- Authentification admin, gestion des erreurs, routes protégées et ouverture du tableau de bord.
- Produits : rendu des données API, recherche et validation des champs requis.
- Stock et bon de sortie : affichage des référentiels/quantités sans données préexistantes.
- Le schéma Prisma identifie aussi les parcours à ajouter sur base de test : `StockCommercial`, `BonSortie`, `BonLivraison`, `InventaireCommercial`, `Facture`, `Fournisseur`, `InfoSociete` et leurs lignes.

Les rapports HTML, traces, vidéos et captures d'échec sont produits dans `playwright-report/` et `test-results/`.
