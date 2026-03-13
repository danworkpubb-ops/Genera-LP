# Architettura SaaS: Sales Site Generator

Questa piattaforma permette agli utenti di creare e gestire siti di vendita (landing page) in modo automatizzato.

## 1. Architettura di Sistema

L'architettura è basata su un modello **Multi-Tenant** dove la piattaforma principale (Dashboard) gestisce la creazione e il monitoraggio dei siti "figli".

### Componenti Core:
- **Dashboard (Next.js/Vite):** L'interfaccia dove l'utente gestisce i suoi siti, prodotti e ordini.
- **Backend API:** Gestisce l'orchestrazione tra Supabase, GitHub e Vercel.
- **Template Repository:** Un repository GitHub "base" che viene clonato per ogni nuovo sito.
- **Supabase:** Database centrale per utenti, siti, prodotti e ordini.

## 2. Struttura delle Cartelle (Progetto Principale)

```text
/
├── src/
│   ├── components/       # Componenti UI (Dashboard, Forms, Charts)
│   ├── hooks/            # Hook personalizzati (auth, data fetching)
│   ├── lib/              # Configurazioni (supabase, resend, utils)
│   ├── services/         # Logica API (github.ts, vercel.ts, orders.ts)
│   ├── types/            # Definizioni TypeScript
│   ├── App.tsx           # Entry point React
│   └── main.tsx
├── server/               # Backend Express (per orchestrazione API)
│   ├── routes/           # Endpoint per deploy, github, ordini
│   └── index.ts
├── .env.example          # Variabili d'ambiente (GITHUB_TOKEN, VERCEL_TOKEN, etc.)
└── package.json
```

## 3. Architettura Database (Supabase)

### Tabelle:
1. **profiles**: Estensione di `auth.users`.
   - `id` (uuid, PK)
   - `email` (text)
   - `full_name` (text)
2. **sites**: I siti creati dagli utenti.
   - `id` (uuid, PK)
   - `user_id` (uuid, FK -> profiles.id)
   - `name` (text)
   - `subdomain` (text)
   - `vercel_project_id` (text)
   - `github_repo_url` (text)
   - `status` (enum: 'deploying', 'ready', 'error')
3. **products**: Prodotti associati ai siti.
   - `id` (uuid, PK)
   - `site_id` (uuid, FK -> sites.id)
   - `name` (text)
   - `description` (text)
   - `price` (numeric)
   - `image_url` (text)
4. **orders**: Ordini ricevuti (Pagamento alla consegna).
   - `id` (uuid, PK)
   - `site_id` (uuid, FK -> sites.id)
   - `product_id` (uuid, FK -> products.id)
   - `customer_name` (text)
   - `customer_address` (text)
   - `customer_phone` (text)
   - `status` (enum: 'pending', 'shipped', 'delivered', 'cancelled')
   - `created_at` (timestamp)

## 4. Flusso di Lavoro

1. **Registrazione:** L'utente si registra tramite Supabase Auth. Un trigger in Supabase crea il profilo nella tabella `profiles`.
2. **Creazione Sito:**
   - L'utente inserisce il nome del sito e il sottodominio desiderato.
   - Il backend chiama l'API di GitHub per creare un nuovo repo da un template.
   - Il backend chiama l'API di Vercel per creare un progetto collegato al nuovo repo.
   - Vercel avvia il deploy. Il `vercel_project_id` viene salvato in Supabase.
3. **Gestione Prodotti:** L'utente aggiunge prodotti tramite la dashboard. Questi dati vengono salvati in Supabase.
4. **Landing Page:** Il sito generato (Vercel) legge i dati dei prodotti da Supabase in tempo reale.
5. **Ordine:** Quando un cliente finale compila il form "Pagamento alla consegna" sulla landing page, viene inviata una richiesta al database Supabase (tabella `orders`).

## 5. Strategia di Aggiornamento Massivo (One Repo, Many Projects)

Per evitare di dover aggiornare centinaia di repository, utilizziamo un approccio a repository unico:

1. **Repository Core:** Un unico repository GitHub contiene il "motore" delle landing page.
2. **Orchestrazione Vercel:** Per ogni nuovo utente, la piattaforma crea un nuovo progetto Vercel collegato al Repository Core.
3. **Environment Variables:** Durante la creazione del progetto Vercel, la piattaforma inietta le chiavi specifiche:
   - `VITE_USER_ID`: L'ID univoco dell'utente nel database.
   - `VITE_THEME_CONFIG`: Impostazioni iniziali del design.
4. **Aggiornamenti:** Ogni `git push` sul Repository Core scatena automaticamente il redeploy di tutti i progetti Vercel collegati, garantendo che tutti gli utenti abbiano sempre l'ultima versione del software e i nuovi design.

### Flusso API Vercel per Nuovo Utente:
1. `POST /v9/projects`: Crea progetto collegato al repo core.
2. `POST /v9/projects/{id}/env`: Inserisce `VITE_USER_ID`.
3. `POST /v9/projects/{id}/domains`: Collega il dominio dell'utente.

---
Generato da Software Architect Senior.
