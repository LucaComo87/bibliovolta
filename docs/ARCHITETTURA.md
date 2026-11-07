# BIBLIOVOLTA · Architettura (Fase 1)

Documento di riferimento per tutte le fasi successive. Le scelte qui descritte **non vanno modificate** senza aggiornare questo file.

## 1. Architettura generale

```
 Browser (studenti / docenti)
        │  HTTPS
        ▼
 ┌─────────────────────────── Vercel ───────────────────────────┐
 │  Next.js 16 (App Router, React 19, TypeScript, Tailwind 4)    │
 │                                                               │
 │  proxy.ts ── rinnova la sessione Supabase, blocca /studente   │
 │              e /docenti a chi non ha effettuato l'accesso     │
 │  Server Components / Server Actions / Route Handlers          │
 │     lib/auth/session.ts  ← unico punto che legge l'utente     │
 │     lib/supabase/server  ← client con identità dell'utente    │
 │     lib/supabase/admin   ← service role, solo lato server     │
 │     lib/email/resend     ← invio email                        │
 └──────────────┬───────────────────────────────┬────────────────┘
                │                               │
                ▼                               ▼
 ┌──────── Supabase (UE) ────────┐      ┌──── Resend ────┐
 │ Auth: Google OAuth (studenti) │      │ email ai       │
 │       email+password (docenti)│      │ destinatari    │
 │ PostgreSQL + Row Level Security│     └────────────────┘
 │ trigger: profili, capienza,    │
 │          registro operazioni   │
 └────────────────────────────────┘
```

**Tre livelli di protezione**, dal più esterno al più interno:

1. **Proxy** (`src/proxy.ts`): senza sessione valida non si entra nelle aree riservate.
2. **Server** (`requireRole()` in `lib/auth/session.ts`): ogni pagina riservata verifica il ruolo leggendolo dal database; il JWT è verificato con `getClaims()`.
3. **Database** (RLS + trigger): anche chiamando direttamente le API Supabase con la chiave pubblica, uno studente vede solo le proprie righe e non può scrivere su prenotazioni, giornate, impostazioni o registro. Il limite dei 50 posti è garantito da un trigger con blocco di riga, quindi resiste a prenotazioni simultanee.

**Autenticazione**

- Studenti: Google OAuth. Il trigger `handle_new_auth_user` accetta solo email `@stud.liceovoltacomo.edu.it` **e** provider `google`; qualsiasi altro account viene rifiutato al momento della registrazione.
- Docenti: email + password, creati solo con `npm run teacher:create` (service role). Il ruolo arriva da `app_metadata.bibliovolta_role`, che il browser non può impostare.

## 2. Database

| Tabella | Contenuto | Relazioni |
|---|---|---|
| `app_settings` | riga unica: stagione, capienza e orari predefiniti, ore di preavviso per l'annullamento (24), dominio studenti | `updated_by → teachers` |
| `students` | profilo studente (email, nome, classe, attivo) | `id → auth.users` (1:1) |
| `teachers` | profilo docente, flag `is_admin` | `id → auth.users` (1:1) |
| `school_days` | una riga per giorno feriale: aperta/chiusa, motivo chiusura, capienza, orari, nota | — |
| `bookings` | prenotazioni (`confirmed` / `cancelled`, origine, chi e quando ha annullato) | `student_id → students`, `school_day_id → school_days` |
| `waitlist_entries` | iscrizioni alla lista d'attesa, ordinate per `joined_at` | `→ students`, `→ school_days` |
| `seat_offers` | proposte di posto al primo in lista, con scadenza | `→ waitlist_entries`, `→ students`, `→ school_days`, `booking_id → bookings` |
| `announcements` | comunicazioni dei docenti (tutti / prenotati di un giorno / singolo studente; bozza o pubblicata) | `author_id → teachers`, `→ school_days`, `→ students` |
| `announcement_deliveries` | destinatari effettivi, stato email Resend, lettura | `→ announcements`, `→ students` |
| `audit_log` | registro immutabile di ogni inserimento/modifica/eliminazione | `actor_id` = utente che ha agito |

Vincoli principali:

- giornate solo da lunedì a venerdì e dentro la stagione; una giornata chiusa deve avere un motivo;
- **una sola prenotazione confermata per studente per giornata** (indice univoco parziale);
- una sola iscrizione attiva in lista d'attesa e una sola proposta pendente per iscrizione;
- capienza non riducibile sotto i posti già prenotati.

Funzioni: `is_teacher()`, `is_admin_teacher()`, `is_student()`, `current_app_role()`, `get_day_availability(da, a)` (solo conteggi, nessun dato personale), `generate_school_days(da, a)` (riservata ai docenti).

Calendario generato: **145 giornate**, da lunedì 16/11/2026 a venerdì 04/06/2027, 50 posti, 14:15–16:30. Le festività le configurano i docenti; `supabase/seed/festivita_nazionali.sql` chiude facoltativamente le sole festività nazionali.

### Matrice dei permessi (RLS)

| | anon | studente | docente | docente admin |
|---|---|---|---|---|
| proprio profilo | — | lettura | lettura | lettura |
| altri studenti | — | — | lettura/scrittura | + eliminazione |
| docenti | — | — | lettura | gestione |
| giornate | — | lettura | gestione | gestione |
| prenotazioni / liste / proposte | — | lettura proprie (scrittura via RPC nelle fasi 4 e 7) | gestione | gestione |
| comunicazioni | — | lettura di quelle ricevute | gestione | gestione |
| impostazioni | — | lettura | lettura | modifica |
| registro operazioni | — | — | lettura | lettura |

## 3. Struttura delle cartelle

```
bibliovolta/
├── docs/ARCHITETTURA.md          questo documento
├── PROJECT_STATUS.md             stato di avanzamento per fasi
├── README.md                     istruzioni di installazione e pubblicazione
├── .env.example                  variabili d'ambiente (senza valori)
├── scripts/
│   ├── test-db.ts                test automatici di schema, RLS, capienza
│   └── create-teacher.ts         creazione account docente (service role)
├── supabase/
│   ├── migrations/               SQL da applicare in ordine
│   │   ├── …0001_schema.sql
│   │   ├── …0002_functions_triggers.sql
│   │   ├── …0003_rls.sql
│   │   └── …0004_calendar_seed.sql
│   └── seed/festivita_nazionali.sql   facoltativo
└── src/
    ├── proxy.ts                  sessione + protezione rotte
    ├── app/
    │   ├── layout.tsx, page.tsx  struttura e pagina iniziale
    │   ├── accesso/              pagina di accesso (pulsanti attivi in Fase 3)
    │   ├── auth/callback/        ritorno OAuth Google
    │   ├── studente/             area studente (protetta)
    │   ├── docenti/              area docenti (protetta)
    │   ├── stato/                diagnostica configurazione e database
    │   ├── api/health/           stato in JSON
    │   └── fonts/                font ospitati localmente
    ├── components/
    │   ├── ui/                   Button, Card, Badge, Notice, PageHeading, Skeleton
    │   ├── layout/               SiteHeader, SiteFooter, PageContainer
    │   ├── auth/                 LoginError, AreaLoading
    │   └── system/               SystemStatus
    └── lib/
        ├── config.ts             costanti (calendario, rotte, dominio)
        ├── env.ts                lettura variabili d'ambiente
        ├── dates.ts              date in italiano, fuso Europe/Rome
        ├── database.types.ts     tipi dello schema
        ├── health.ts             controllo stato del sistema
        ├── auth/session.ts       getCurrentUser, requireRole
        ├── supabase/             client browser, server, admin, proxy
        └── email/resend.ts       invio email
```

Cartelle previste per le fasi successive (da creare quando servono): `src/app/studente/prenota`, `src/app/docenti/calendario`, `src/app/docenti/prenotazioni`, `src/app/docenti/comunicazioni`, `src/lib/bookings`, `src/lib/email/templates`, `supabase/migrations/…_booking_rpc.sql`.

## 4. Componenti principali

| Componente | Ruolo |
|---|---|
| `proxy.ts` + `lib/supabase/proxy.ts` | rinnovo sessione e blocco aree riservate |
| `lib/auth/session.ts` | Data Access Layer: identità verificata e ruolo dal DB |
| `lib/supabase/{client,server,admin}.ts` | i tre client Supabase, con confini netti (admin è `server-only`) |
| `lib/health.ts` / `/stato` / `/api/health` | verifica reale di configurazione e database |
| `lib/email/resend.ts` | invio email lato server |
| `components/ui/*` | mattoni grafici riutilizzabili |
| `components/layout/*` | intestazione, piè di pagina, contenitore |

Con `cacheComponents` attivo (default di Next.js 16), tutto ciò che legge la sessione sta dentro un `<Suspense>` ed è valutato alla richiesta (`connection()`), mai prerenderizzato.

## 5. Configurazioni esterne necessarie

1. **Supabase**: progetto in regione UE; applicare le migrazioni; Auth → URL Configuration (Site URL e redirect `…/auth/callback`); provider Google attivo; provider Email attivo con conferma email.
2. **Google Cloud Console**: client OAuth "Applicazione web" con redirect `https://<progetto>.supabase.co/auth/v1/callback`; schermata di consenso "Interna" se gli account studenti fanno parte del Google Workspace della scuola.
3. **Resend**: verifica DNS del dominio mittente (serve l'intervento di chi gestisce il dominio della scuola), chiave API.
4. **Vercel**: importazione del repository e variabili d'ambiente di `.env.example`.
5. **GitHub**: repository (anche privato) collegato a Vercel per la pubblicazione automatica.

## 6. Identità visiva e interfaccia (Fase 2)

- **Colori** (`src/app/globals.css`): blu istituzionale `--ink #0f2350`, bianco, oro `--gold #c39a45` (cornici, accenti, prenotazioni dello studente), legno `--wood #6e4428` (etichette, sezioni informative), sfondo chiaro `--paper #f5f6f9`. Colori di stato separati: verde disponibile, ambra ultimi posti (≤ 10), rosso completo.
- **Tipografia**: Fraunces per i titoli (evoca i volumi della biblioteca), Inter per i testi; ospitati localmente.
- **Fotografia**: sempre tramite `LibraryBackdrop` con overlay blu; inquadrature su volta, stemma e ballatoi.
- **Responsive**: area studenti con barra di navigazione inferiore su smartphone; prenotazione in due tocchi (giornata già selezionata → «Prenota il posto» → «Conferma» nel pannello dal basso); calendario con sole colonne lun–ven.
- **Animazioni**: comparsa morbida (`animate-rise`), pannelli dal basso, barre che si riempiono; tutte disattivate con «riduci movimento».
- **Dati dimostrativi**: solo in `src/lib/demo/` e nelle rotte `/anteprima`, mai nelle pagine reali.

Cartelle aggiunte: `assets/originale`, `src/assets`, `src/components/{brand,media,calendar,student,teacher,demo}`, `src/lib/{calendar,booking-rules}.ts`, `src/lib/demo`, `src/app/anteprima`.

## 7. Autenticazione (Fase 3)

```
Studente  → /accesso → Server Action startGoogleSignIn (PKCE, hd=stud.liceovoltacomo.edu.it)
          → Supabase Auth /authorize → Google → Supabase Auth /callback
              └ inserimento in auth.users → trigger handle_new_auth_user:
                provider google + dominio esatto + email verificata, altrimenti ERRORE
          → /auth/callback (scambio codice server-server, ricontrollo identità e ruolo)
          → /registrazione (prima volta) → /studente

Docente   → /accesso/docenti → Server Action teacherSignIn
              └ auth_lockout_seconds (5 errori/15 min per email, 20 per IP)
              └ signInWithPassword → profilo in teachers (solo email invitate)
          → /docenti/password (obbligatorio con la password iniziale) → /docenti
```

Regole del proxy (`lib/auth/routing.ts`), applicate prima del rendering e ripetute da `requireRole`:

| Sessione | /studente, /registrazione | /docenti |
|---|---|---|
| nessuna o non valida | → /accesso | → /accesso/docenti |
| studente (Google) | ok; da registrare → /registrazione | → /studente |
| docente (password) | → /docenti | ok; password iniziale → /docenti/password |

Una sessione con metodo incoerente (docente via Google, studente via password) è considerata non valida.

Tabelle e funzioni aggiunte (migrazione 5): `students.registered_at`, `teachers.must_change_password`, `teacher_invitations`, `auth_attempts`; `is_allowed_student_email`, `complete_student_registration` (authenticated), `mark_teacher_password_changed`, `require_teacher_password_change`, `auth_lockout_seconds`, `record_auth_attempt` (solo service role).

Il client Supabase del browser è stato rimosso: la sessione vive in cookie httpOnly e tutte le operazioni di autenticazione sono Server Actions o Route Handlers.

## 8. Prenotazioni (Fase 4)

```
Studente ─ Prenota ─► Server Action bookSeat ─► rpc book_seat (sessione dello studente)
                                                 ├ SELECT … FOR UPDATE sulla giornata  ← le richieste concorrenti si mettono in fila
                                                 ├ giornata aperta? prima dell'apertura?
                                                 ├ già prenotata dallo studente?        ← anche indice univoco parziale
                                                 ├ prenotazioni attive < capienza (50)?
                                                 └ INSERT  (trigger: secondo controllo della capienza + registro)
          ◄─ esito + refresh() ─ calendario e area personale aggiornati
```

- Nessuna scrittura diretta degli studenti su `bookings`: solo `book_seat` e `cancel_booking` (security definer, `auth.uid()`).
- Scadenza annullamento = `(giorno + orario di apertura) at time zone 'Europe/Rome' − cancellation_hours`, calcolata da PostgreSQL: il cambio d'ora è gestito dal database (es. lunedì 29/3/2027 → domenica 28/3 alle 14:15 CEST).
- L'orario di apertura è per giornata (`school_days.opens_at`); `set_opening_hours` cambia il predefinito e tutte le giornate future.
- Stati: DISPONIBILE (> 5 posti), QUASI COMPLETA (1–5), COMPLETA (0), CHIUSA (giornata chiusa); CONCLUSA per le giornate passate.

## 9. Lista d'attesa automatica (Fase 5)

```
annullamento ──► trigger after_booking_cancelled ──► process_day_waitlist (giornata FOR UPDATE)
                                                       ├ giornata aperta, lista attiva, prima della soglia 24 h?
                                                       ├ posti liberi = capienza − confermate − proposte aperte
                                                       └ per ogni posto: proposta al primo in coda (queue_seq)
                                                            token casuale → hash SHA-256 in seat_offers
                                                            email in notification_outbox (con il token in chiaro)
Supabase Cron (ogni minuto) ──► run_waitlist_maintenance: proposte scadute → expired → successivo
pg_net / Vercel ──► /api/cron/notifications (CRON_SECRET) ──► manutenzione + invio email (Resend)
studente ──► /proposta/<token> ──► POST ──► accept_offer_by_token (service role) ──► prenotazione + email
```

- Un posto proposto è **trattenuto**: `book_seat` conta confermate + proposte aperte, quindi non si superano mai 50 prenotazioni, neanche con conferme e prenotazioni simultanee.
- Ordine dei blocchi sempre giornata → proposta/iscrizione per evitare stalli.
- Regola delle 24 ore: dopo `cancellation_deadline` nessuna nuova iscrizione e nessuna nuova proposta; una proposta già inviata resta confermabile fino alla sua scadenza; se scade, il posto torna prenotabile normalmente.
- Chiusura di una giornata (trigger `after_school_day_change`): proposte aperte annullate (gli studenti tornano in coda con la loro posizione), email ai prenotati e agli studenti in lista; riapertura → la coda riparte.
- Il token non è mai salvato in chiaro nelle tabelle: solo l'hash in `seat_offers` e, fino all'invio, nella coda email (accessibile solo al service role, svuotata dopo l'invio).

## 10. Dashboard docenti e comunicazioni (Fase 6)

**Principio**: ogni operazione dei docenti passa da una funzione `SECURITY DEFINER` della migrazione 8 che (1) ricontrolla il ruolo con `require_teacher()`, (2) modifica i dati con i blocchi necessari, (3) mette in coda le email in `notification_outbox`, (4) scrive il registro `audit_log` con azione `docente.*`. Le Server Action in `app/docenti/(area)/manage-actions.ts` validano l'input (zod), chiamano la funzione, aggiornano la pagina con `refresh()` e avviano l'invio con `after(dispatchSoon)`.

| Operazione | Funzione | Registro |
|---|---|---|
| Chiudere / riaprire / modificare una giornata | `teacher_update_day(…, p_notice, p_subject, p_message)` | `giornata_chiusa`, `giornata_riaperta`, `orario_giornata`, `giornata_modificata` |
| Orario generale | `set_opening_hours` | `orario_generale` |
| Annullamento manuale | `teacher_cancel_booking(id, motivo, avvisa)` | `prenotazione_annullata` |
| Comunicazione | `send_announcement` → `create_day_announcement` | `comunicazione_inviata` |
| Nuovo invio dei falliti | `retry_announcement` | `comunicazione_reinvio` |
| Impostazioni lista d'attesa | `set_offer_minutes`, `set_waitlist_paused`, `teacher_remove_waitlist_entry` | `impostazioni`, `lista_*` |

**Chiusura con comunicazione**: `teacher_update_day` imposta per la sola transazione `bibliovolta.closure_notice` (`default` | `custom` | `none`); il trigger `after_school_day_change` invia gli avvisi standard solo con `default`, mentre con `custom` la funzione crea una comunicazione (prenotati + lista d'attesa) con il testo del docente. Così nessuno studente riceve due email.

**Esito delle email**: ogni comunicazione crea una riga in `announcement_deliveries` per destinatario e una in `notification_outbox` collegata (`delivery_id`). `complete_notification(id, ok, provider_id, errore, permanente)` aggiorna entrambe: inviata (con id di Resend), errore temporaneo (nuovo tentativo, massimo 5), errore definitivo (`validation_error` di Resend → subito «non recapitata» con il motivo).

**Letture** (`lib/teacher/data.ts`, con la RLS dei docenti): dashboard, elenco iscritti, giornate per il compositore, storico delle comunicazioni, registro; `teacher_stats()` calcola le statistiche nel database (`lib/teacher/stats.ts` le adatta ai grafici). Descrizioni leggibili del registro in `lib/teacher/activity.ts`, modelli dei messaggi in `lib/teacher/templates.ts`.

**Esportazione**: `GET /docenti/iscritti/esporta?giorno=&formato=csv|xlsx` (route handler: ruolo verificato, `cache-control: no-store`); CSV UTF-8 con BOM e `;` per Excel in italiano, celle che iniziano con `= + - @` neutralizzate; Excel generato con `exceljs`.

**Viste** (`components/teacher/views/*`) ricevono dati e azioni come props; i wrapper `components/teacher/live/*` collegano le Server Action, le pagine `/anteprima/docenti/*` passano dati dimostrativi senza azioni.

## 11. Collaudo, sicurezza, privacy e pubblicazione (Fase 7)

**Migrazione 9** `…_privacy_retention.sql`:
- `audit_row_change` riscritta: il registro tecnico salva le righe senza `email`, nomi, `token_hash`, `to_email`; per le modifiche a questi campi registra solo «modificato»; per le eliminazioni solo l'id. Le righe già presenti vengono ripulite.
- `minimize_auth_metadata` / `minimize_identity_data` (trigger su `auth.users` e `auth.identities`): rimuovono foto, telefono e lingua dai metadati dell'account Google.
- `handle_new_auth_user`: gli inviti docenti valgono 30 minuti.
- `export_my_data()` (studente, sé stesso), `erase_student(id)` e `purge_expired_data()` (solo service role); tempi di conservazione in `app_settings` (`retention_months` 12, `inactive_student_months` 12, `audit_retention_months` 24, `technical_retention_days` 30); job notturno `bibliovolta-conservazione`. La pulizia imposta `bibliovolta.purge = on` per non generare voci di registro personali.

**Applicazione**: pagina `/privacy` generata da `src/lib/privacy/informativa.ts` (stessa fonte di `docs/INFORMATIVA_PRIVACY.md`, `npm run privacy:doc`); link nell'accesso, nella registrazione, nel piè di pagina e nell'area personale; `GET /studente/i-miei-dati` (download JSON); Content Security Policy e `Cross-Origin-Opener-Policy` in `next.config.ts`; `vercel.json` (regione fra1, cron giornaliero di riserva); script `privacy:*` e `db:backup`.

**Correzioni grafiche emerse dal collaudo multi-dispositivo**: griglie a una colonna esplicita (`grid-cols-1`) e contenitori scorrevoli `relative` nelle pagine Iscritti e Comunicazioni, che su smartphone allargavano la pagina; finestre di conferma scorrevoli con pulsanti sempre visibili.

**Collaudo** (`npm run test:all` → `docs/TEST_REPORT.md`): tipi, lint, `db:test`, build, e sei suite end-to-end sulla build di produzione con lo stack Supabase locale: `test:auth`, `test:bookings`, `test:waitlist`, `test:teacher`, `test:security` (attacchi diretti alle API e al database, intestazioni, chiavi nei file del browser, link, privacy), `test:ui` (15 pagine + registrazione × smartphone, tablet, computer: scorrimento orizzontale, errori in console, risorse e immagini, foto e logo, navigazione).

## 12. Docenti di turno (7/11/2026)

Migrazione 10 `…_supervision_shifts.sql`: tabella `supervision_shifts` (giornata, docente collegato facoltativo, nome mostrato, chi l'ha assegnato) con RLS di sola lettura per i docenti e nessuna scrittura diretta. Funzioni `take_shift(giornata)` (il docente collegato; se l'amministratore aveva già scritto lo stesso nome, il turno viene collegato al suo account), `assign_shift(giornata, nome)` (solo `is_admin`; il nome viene ripulito e collegato all'account se corrisponde a un solo docente registrato), `remove_shift(id)` (il proprio, o qualsiasi per l'amministratore). Massimo `app_settings.max_shifts_per_day` (3) per giornata, niente turni nelle giornate passate, registro `docente.turno_preso|turno_assegnato|turno_rimosso`.

Interfaccia: `components/teacher/ShiftPanel.tsx` (nel riquadro della giornata del calendario e nella pagina `/docenti/turni`, `TeacherShiftsView`), dashboard con chi è di turno e avviso per le giornate scoperte, elenco iscritti ed Excel con i docenti di turno. Dati: `lib/teacher/shifts.ts` (tollerante se la migrazione non è ancora applicata).
