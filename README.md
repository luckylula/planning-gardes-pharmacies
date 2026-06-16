# Planning Gardes Pharmacies — Secteur Albertville

Application web pour générer et gérer le planning annuel de gardes de pharmacies du secteur d'Albertville (Savoie, France).

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Prisma + Neon PostgreSQL**
- **SheetJS (xlsx)** pour import/export Excel
- **TypeScript**

## Démarrage

### 1. Configuration

```bash
cp .env.example .env
```

Renseignez `DATABASE_URL` avec votre chaîne de connexion [Neon](https://neon.tech).

### 2. Base de données

```bash
npm install
npx prisma db push
```

### 3. Lancement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Utilisation

1. **Importer** un planning Excel existant (ex. 2026) via `/import` pour initialiser les rotations.
2. **Générer** une nouvelle année via `/generate` — les paramètres sont déduits de l'année précédente.
3. **Consulter / modifier** le planning sur `/planning/[year]`.
4. **Exporter** au format Excel Norman via le bouton « Exporter Excel ».

## Déploiement Vercel

1. Créez un projet sur [Vercel](https://vercel.com) lié à ce dépôt.
2. Ajoutez la variable d'environnement `DATABASE_URL`.
3. Le build exécute automatiquement `prisma generate`.

## Groupes de pharmacies

| Groupe | Pharmacies | Gardes |
|--------|-----------|--------|
| Centre Albertville | 8 | Week-ends + fériés |
| Maurienne | 2 | Lundis en alternance |
| Extérieures | 10 | Mardi–vendredi (Mercury & Fina Tardy : 2 jours consécutifs) |

## Structure

```
src/
  lib/
    generatePlanning.ts   # Logique de génération
    pharmacies.ts         # Données des 20 pharmacies
    excel.ts              # Import/export xlsx
  components/             # UI réutilisable
  app/                    # Pages et API routes
```
