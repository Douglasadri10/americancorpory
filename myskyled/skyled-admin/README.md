# SKYLED Admin (Skeleton)

Stack: **Next.js 14 (App Router) + Tailwind + Firebase (Auth, Firestore, Storage)**.

## Setup rápido
1. `cp .env.local.example .env.local` e preencha as variáveis Firebase.
2. `npm install`
3. `npm run dev`

Rotas principais já criadas:
- `/login`
- `/` (Dashboard)
- `/items`, `/warehouses`, `/clients`, `/projects`
- `/stock/move` (lançar movimentação simples)

> Base do MVP pronta para ligar Firestore/Auth e evoluir para BOM/Orçamentos/Invoices.
