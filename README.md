# BIBLIOVOLTA

Piattaforma di prenotazione dell'aula studio della biblioteca del **Liceo A. Volta di Como**.

Gli studenti entrano con l'account Google della scuola (`@stud.liceovoltacomo.edu.it`), scelgono un pomeriggio e prenotano uno dei 50 posti; quando una giornata è completa si iscrivono alla lista d'attesa e, se si libera un posto, ricevono un'email con un link personale per confermarlo. I docenti gestiscono calendario, aperture e chiusure, orari, elenco degli iscritti, comunicazioni via email, statistiche e registro delle operazioni da un'unica dashboard.

- **Periodo**: lunedì 16 novembre 2026 → venerdì 4 giugno 2027, dal lunedì al venerdì, 14:15–16:30 (orario modificabile dai docenti); festività nazionali chiuse.
- **Capienza**: 50 posti al giorno, modificabile per singola giornata.
- **Stack**: Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Cron) · Resend · Vercel.

| Documento | Contenuto |
|---|---|
| [`docs/PUBBLICAZIONE.md`](docs/PUBBLICAZIONE.md) | guida passo per passo: Supabase, Google OAuth, Resend, variabili, Vercel, dominio, automazioni, backup |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | stato di ogni funzionalità: COMPLETATO / DA CONFIGURARE / DA VERIFICARE |
| [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) | esito dell'ultimo collaudo completo, verifica per verifica |
| [`docs/PRIVACY_GDPR.md`](docs/PRIVACY_GDPR.md) | misure GDPR, inventario dei dati, conservazione, procedure per i diritti |
| [`docs/INFORMATIVA_PRIVACY.md`](docs/INFORMATIVA_PRIVACY.md) | bozza dell'informativa da approvare (uguale alla pagina `/privacy`) |
| [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md) | dettagli tecnici di ogni fase |
| [`PROJECT_STATUS.md`](PROJECT_STATUS.md) | stato di avanzamento del progetto |

---

## 1. Architettura tecnica

```
Browser (studenti, docenti)
   │  HTTPS, cookie di sessione httpOnly
   ▼
Vercel ─ Next.js 16 (App Router, Server Components, Server Actions)
   │  proxy.ts: ruolo e metodo di accesso controllati prima del rendering
   │  pagine: /, /accesso, /studente/*, /docenti/*, /proposta/[token], /privacy, /stato
   │  API:    /auth/callback, /api/cron/notifications, /api/me, esportazioni CSV/Excel e dati personali
   ▼
Supabase (regione UE)
   ├─ Auth: Google OAuth (studenti), email + password (docenti)
   ├─ PostgreSQL: tabelle con Row Level Security, funzioni atomiche (prenotazioni, lista d'attesa,
   │   comunicazioni, statistiche, privacy), trigger, registro delle operazioni
   └─ Cron (pg_cron + pg_net): lista d'attesa ogni minuto, email ogni minuto, conservazione ogni notte
        │
        ▼
     Resend (email: proposte di posto, conferme, chiusure, comunicazioni, annullamenti)
```

**Principi**
- Le regole importanti stanno **nel database**, non nel browser: limite di 50 posti, una prenotazione per giornata, scadenza delle 24 ore, ordine della lista d'attesa, permessi. Anche chi chiamasse le API direttamente non può aggirarle.
- **Tre livelli di protezione**: proxy → controllo del ruolo lato server (`requireRole`) → Row Level Security e funzioni `SECURITY DEFINER` che ricontrollano il ruolo.
- **Nessuna chiave nel codice**: tutto in variabili d'ambiente; la chiave di servizio è usata solo da codice `server-only`.
- **Email affidabili**: ogni email passa da una coda nel database (`notification_outbox`), è inviata subito dopo l'azione e, in ogni caso, dal cron; l'esito è registrato.
- **Componenti riutilizzabili**: le viste ricevono dati e azioni come proprietà; le stesse schermate servono l'app reale e l'anteprima con dati dimostrativi (`/anteprima`, disattivata in produzione).

**Cartelle principali**

| Percorso | Contenuto |
|---|---|
| `src/app/` | pagine e route (accesso, studente, docenti, proposta, privacy, stato, API) |
| `src/components/` | interfaccia: `ui/` (componenti base), `calendar/`, `student/`, `teacher/`, `waitlist/`, `brand/`, `media/`, `layout/` |
| `src/lib/` | logica: `auth/`, `supabase/`, `bookings/`, `waitlist/`, `teacher/`, `email/`, `privacy/`, date e configurazione |
| `supabase/migrations/` | 9 migrazioni SQL (schema, funzioni, RLS, calendario, auth, prenotazioni, lista d'attesa, dashboard docenti, privacy) |
| `scripts/` | amministrazione (docenti, privacy, backup) e test (database, end-to-end, sicurezza, grafica) |
| `docs/` | documentazione |

## 2. Struttura del database

| Tabella | Contenuto |
|---|---|
| `app_settings` | parametri globali: stagione, capienza e orario predefiniti, ore per annullare (24), tempo per confermare una proposta (120 min), dominio studenti, tempi di conservazione |
| `school_days` | una riga per giornata feriale: aperta/chiusa con motivo, capienza, orario, nota, lista d'attesa sospesa |
| `students` | profilo studente (1:1 con l'account Google): email, nome, cognome, classe, data di registrazione |
| `teachers` / `teacher_invitations` | docenti (email, nome, amministratore, obbligo di cambio password) e inviti temporanei per crearli |
| `bookings` | prenotazioni: studente, giornata, stato (confermata/annullata), origine, chi e perché ha annullato |
| `waitlist_entries` | iscrizioni alla lista d'attesa in ordine cronologico rigoroso (`queue_seq`) |
| `seat_offers` | proposte di posto: impronta del link, scadenza, esito |
| `announcements` / `announcement_deliveries` | comunicazioni dei docenti e esito dell'email per ogni destinatario |
| `notification_outbox` | coda delle email (solo server) |
| `audit_log` | registro delle operazioni (docenti in forma leggibile, tecnico senza dati personali) |
| `auth_attempts` | tentativi di accesso dei docenti (protezione dai tentativi ripetuti) |

Funzioni principali: `book_seat`, `cancel_booking`, `my_bookings`, `get_day_availability`, `join_waitlist`, `leave_waitlist`, `accept_offer_by_token`, `run_waitlist_maintenance`, `teacher_update_day`, `teacher_cancel_booking`, `send_announcement`, `retry_announcement`, `teacher_stats`, `export_my_data`, `erase_student`, `purge_expired_data`. Elenco completo dei permessi in `docs/ARCHITETTURA.md`.

## 3. Funzionamento delle prenotazioni

1. Lo studente entra con Google; al primo accesso completa nome, cognome e classe (l'email arriva da Google e non si modifica).
2. Nel calendario mensile (solo lunedì–venerdì) ogni giornata mostra prenotati, posti disponibili e stato: **DISPONIBILE**, **QUASI COMPLETA** (5 posti o meno), **COMPLETA**, **CHIUSA**.
3. «Prenota il posto» → conferma → la funzione `book_seat` blocca la riga della giornata (`FOR UPDATE`), controlla capienza, giornata aperta, orario non ancora iniziato e assenza di altre prenotazioni dello stesso studente, poi registra. Con 70 richieste contemporanee per 50 posti ne passano esattamente 50.
4. Oltre il limite compare: *«È stato raggiunto il numero massimo di 50 prenotazioni. Puoi iscriverti alla lista d'attesa.»*
5. Annullamento dall'area personale fino a **24 ore prima dell'apertura** (calcolo nel fuso Europe/Rome, ora legale compresa); dopo, il pulsante è disattivato e il database rifiuta comunque l'operazione.
6. Il posto liberato va subito al primo in lista d'attesa, se c'è.

## 4. Funzionamento della lista d'attesa

1. Sulle giornate complete compare «**ISCRIVITI ALLA LISTA D'ATTESA**»: posizione assegnata in ordine di iscrizione, niente doppioni, uscita possibile in ogni momento («Le mie liste d'attesa»).
2. Quando si libera un posto il database crea una **proposta** per il primo in coda e trattiene il posto; parte un'email con un **link personale** (256 bit casuali, monouso, salvato solo come impronta SHA-256).
3. Lo studente conferma entro **2 ore** (tempo modificabile dai docenti) dal link o dall'area personale; la conferma richiede un clic (aprire il link non basta).
4. Se non conferma o rinuncia, la proposta scade e il posto passa automaticamente al successivo (Supabase Cron, ogni minuto, anche senza nessuno collegato).
5. Nelle **24 ore prima dell'apertura** non partono nuove proposte; quelle già inviate restano valide fino alla scadenza.
6. Se i docenti chiudono la giornata, le proposte aperte sono annullate, la lista è sospesa e gli studenti vengono avvisati.

## 5. Gestione docenti

- **Accesso**: `/accesso/docenti` con email e password; account creati dall'amministratore (`npm run teacher:create`), password iniziale da variabile d'ambiente, cambio obbligatorio al primo accesso, blocco dopo 5 errori.
- **Dashboard**: prenotazioni di oggi, iscritti, giornate complete e chiuse, studenti in lista d'attesa, grafico delle prossime giornate, ultime operazioni, «INVIA COMUNICAZIONE AGLI ISCRITTI».
- **Calendario**: vista mensile; per giornata iscritti, posti liberi, lista; chiusura con motivo e **conferma** con scelta della comunicazione (automatica, personalizzata, nessuna); riapertura; orario e capienza della singola giornata; orario generale.
- **Iscritti**: elenco per giornata con nome, cognome, classe, email, data e ora; ricerca, filtro per classe, ordinamento; esportazione **CSV** ed **Excel**; annullamento manuale con motivo ed email facoltativa.
- **Lista d'attesa**: code per giornata, proposte aperte e scadute, rimozione, sospensione, tempo per confermare.
- **Comunicazioni**: email ai prenotati e/o alla lista d'attesa di una giornata, con modelli, anteprima, conferma del numero di destinatari e storico con l'esito di ogni invio e «Riprova l'invio».
- **Statistiche**: totale, media giornaliera, occupazione, giornate più frequentate, classi più rappresentate, andamento settimanale.
- **Registro**: tutte le operazioni dei docenti con autore, filtri e ricerca.

## 6. Configurazioni necessarie

Riepilogo (dettagli in [`docs/PUBBLICAZIONE.md`](docs/PUBBLICAZIONE.md)):

1. **Supabase**: progetto in regione UE, 9 migrazioni, URL di reindirizzamento, provider Google ed Email, chiavi API.
2. **Google Cloud**: schermata di consenso (Interno se possibile), client OAuth «Applicazione web» con il callback di Supabase.
3. **Resend**: dominio mittente verificato (SPF, DKIM, DMARC), API key.
4. **Variabili d'ambiente** (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `TEACHER_INITIAL_PASSWORD`, `ENABLE_UI_PREVIEW=false`.
5. **Vercel**: importazione del repository, variabili, dominio (`vercel.json` imposta la regione di Francoforte e un cron giornaliero di riserva).
6. **Automazioni**: Supabase Cron + pg_net (lista d'attesa e email ogni minuto, conservazione ogni notte).
7. **Docenti**: `npm run teacher:create` per ciascuno.
8. **Privacy**: approvazione dell'informativa, DPA con i fornitori, registro dei trattamenti.

## 7. Sviluppo e test

Requisiti: Node.js 20.9+ (consigliato 22). Per i test end-to-end: Linux, privilegi di root (usano `/etc/hosts` e la porta 443, ripristinati al termine), Chrome in `/usr/bin/google-chrome` o in `CHROME_PATH`. Lo stack Supabase locale (PostgreSQL 17, Supabase Auth, PostgREST) viene scaricato e avviato senza Docker; Google e Resend sono sostituiti da servizi di prova che parlano gli stessi protocolli.

```bash
npm install
cp .env.example .env.local      # valori reali per lo sviluppo
npm run dev                     # http://localhost:3000  (/anteprima: schermate con dati dimostrativi)
```

| Comando | Cosa fa |
|---|---|
| `npm run test:all` | **collaudo completo** (tipi, lint, database, build e tutte le prove end-to-end) → `docs/TEST_REPORT.md` |
| `npm run check` | tipi, lint, test del database, build |
| `npm run db:test` | migrazioni e regole del database su PostgreSQL in memoria |
| `npm run test:auth` | accesso Google e docenti, registrazione, sessioni, permessi |
| `npm run test:bookings` | prenotazioni, limite 50, concorrenza, annullamento e scadenza, ora legale |
| `npm run test:waitlist` | lista d'attesa, email, link, scadenze, soglia 24 ore, chiusure |
| `npm run test:teacher` | dashboard docenti, iscritti, export, comunicazioni, statistiche, registro |
| `npm run test:security` | dominio, sessioni, intestazioni, permessi, API, database, link, chiavi, privacy |
| `npm run test:ui` | tutte le pagine su smartphone, tablet e computer |
| `npm run teacher:create -- --email … --name "…" [--admin]` | crea un docente |
| `npm run teacher:reset-password -- --email …` | riporta un docente alla password iniziale |
| `npm run privacy:export -- --email …` | copia dei dati di uno studente |
| `npm run privacy:erase -- --email … --conferma` | cancellazione definitiva su richiesta |
| `npm run privacy:purge` | applica subito i tempi di conservazione |
| `npm run privacy:doc` | rigenera `docs/INFORMATIVA_PRIVACY.md` dal testo della pagina `/privacy` |
| `SUPABASE_DB_URL=… npm run db:backup` | backup compresso del database |

## 8. Procedura di aggiornamento

Per ogni modifica (nuova funzione, correzione, cambio di testi):

1. **Ramo di lavoro**: `git checkout -b nome-modifica`.
2. **Database**: mai modificare le migrazioni già applicate in produzione; aggiungere un nuovo file `supabase/migrations/AAAAMMGGhhmmss_descrizione.sql`. Ogni nuova funzione va accompagnata da `revoke execute … from public, anon` e, se serve, `grant … to authenticated`; le funzioni `security definer` devono avere `set search_path = ''`.
3. **Tipi**: aggiornare `src/lib/database.types.ts` (oppure `npx supabase gen types typescript --project-id <ID> > src/lib/database.types.ts`).
4. **Collaudo**: `npm run test:all` deve terminare senza errori; aggiungere le verifiche della nuova funzione al test della relativa area.
5. **Backup**: `npm run db:backup` prima di applicare migrazioni in produzione.
6. **Migrazioni in produzione**: `npx supabase db push` (o SQL Editor, file per file).
7. **Pubblicazione**: merge su `main` → Vercel ripubblica in automatico. Se si usa un progetto Supabase di prova, verificare prima l'anteprima Vercel della pull request.
8. **Controllo**: `/stato` tutto verde e collaudo rapido (docs/PUBBLICAZIONE.md, punto 11).
9. **Documentazione**: aggiornare `PROJECT_STATUS.md`, `docs/CHECKLIST.md` e, se cambiano i dati trattati, l'informativa.

**Nuovo anno scolastico**: aggiornare `season_start`/`season_end` in `app_settings` e generare le giornate con `select public.generate_school_days('AAAA-MM-GG', 'AAAA-MM-GG');`, poi chiudere festività e vacanze dal calendario docenti. I dati dell'anno precedente vengono cancellati automaticamente dopo 12 mesi.

**Aggiornamento delle librerie**: `npm outdated`, aggiornamenti minori con `npm update`, poi `npm run test:all`. Per Next.js leggere prima `node_modules/next/dist/docs/` (vedi `AGENTS.md`).

## 9. Sicurezza e privacy (sintesi)

- Studenti solo con Google e solo `@stud.liceovoltacomo.edu.it` verificati; docenti solo con password, inviti validi 30 minuti, cambio obbligatorio, blocco dopo 5 errori.
- Cookie di sessione httpOnly / Secure / SameSite=Lax; nessun token accessibile da JavaScript.
- Row Level Security su tutte le tabelle: ogni studente legge solo i propri dati; nel calendario vede solo numeri.
- Content Security Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.
- Nessuna chiave nel codice né nei file inviati al browser (verificato da `test:security`).
- Minimizzazione e conservazione automatica (12 mesi / 24 mesi / 30 giorni), download dei propri dati, cancellazione su richiesta.
- Dettagli: [`docs/PRIVACY_GDPR.md`](docs/PRIVACY_GDPR.md).

## 10. Risorse grafiche

- Fotografia originale della biblioteca: `assets/originale/` (non pubblicata); versioni web in `src/assets/`, ottimizzate da `next/image`.
- Logo ufficiale della scuola: `assets/originale/`, versione web `src/assets/logo-liceo-volta.png`.
- Colori e caratteri: `src/app/globals.css`; font locali in `src/app/fonts/`.

---

App pensata e realizzata per il Liceo A. Volta di Como.
