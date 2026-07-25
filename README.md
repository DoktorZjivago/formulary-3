# Formulary — Flavor & Fragrance Bench

A formulation bench for flavor/fragrance chemists: an ingredient library with
chemical class, volatility, odor threshold, usage levels, and molar mass, plus
a formulation builder with automatic ethanol-carrier balancing and PPM
calculations.

This is a standalone export of a Claude-artifact prototype. Data is stored in
your browser's `localStorage` (see note below) — it is **not** synced to any
server or account.

## Run it locally

You'll need [Node.js](https://nodejs.org) (v18+) installed.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Push to GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "Initial commit"
```

Then create a new empty repo on GitHub (no README/license, so it stays
empty), and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## Deploy it live

Once it's on GitHub, both of these give you a free live URL with zero server
setup, and auto-redeploy whenever you push:

**Vercel**
1. Go to vercel.com → New Project → import your GitHub repo
2. Framework preset: Vite (auto-detected)
3. Deploy

**Netlify**
1. Go to netlify.com → Add new site → Import an existing project → your repo
2. Build command: `npm run build`, publish directory: `dist`
3. Deploy

## About data storage

The original prototype ran inside Claude.ai, which provides a built-in
`window.storage` API. This export includes a small polyfill
(`src/main.jsx`) that backs the same API with `localStorage`, so the app
works exactly the same way but data lives only in the browser you're using —
it won't follow you to another device or browser, and clearing site data
will erase it.

If you want real cross-device sync later, the natural next step is swapping
the polyfill for a hosted database (e.g. Supabase) behind the same
`get`/`set`/`delete`/`list` interface — the rest of the app doesn't need to
change.

## Project structure

```
src/
  App.jsx        the full application (ingredient library, formulations, PPM calcs)
  main.jsx       entry point + localStorage polyfill for window.storage
  index.css      Tailwind entry
index.html       Vite HTML shell
```
