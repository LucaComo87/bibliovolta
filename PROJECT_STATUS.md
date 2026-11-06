# BIBLIOVOLTA · PROJECT_STATUS

_Ultimo aggiornamento: 6 novembre 2026 — fine Fase 7 (collaudo, sicurezza, privacy, pubblicazione)_

## Obiettivo
Web app reale per prenotare i posti dell'aula studio del Liceo A. Volta di Como: 50 posti/giorno, lun–ven 14:15–16:30, dal 16/11/2026 al 04/06/2027. Studenti con Google (`@stud.liceovoltacomo.edu.it`), docenti con email e password. Annullamento fino a 24 ore prima.

## Architettura (vedi docs/ARCHITETTURA.md)
Next.js 16 (App Router, `cacheComponents`) + TypeScript + Tailwind 4 su Vercel; Supabase (PostgreSQL con RLS, Auth Google/email); Resend per le email. Protezione a tre livelli: proxy → `requireRole()` lato server → RLS e trigger nel database.

## Piano delle fasi
La numerazione segue le richieste del docente (dalla Fase 5 l'ordine è cambiato rispetto al piano iniziale).

| # | Fase | Stato |
|---|---|---|
| 1 | Architettura, database, struttura progetto | ✅ completata |
| 2 | Interfaccia grafica | ✅ completata |
| 3 | Autenticazione e registrazione | ✅ completata (da collaudare con Google vero dopo la configurazione) |
| 4 | Calendario e prenotazioni (limite 50, annullamento entro 24 h) | ✅ completata |
| 5 | Lista d'attesa automatica (proposte via email, conferma con link, scadenze, cron) | ✅ completata |
| 6 | Dashboard docenti e comunicazioni (iscritti, export, email, chiusure con avviso, statistiche, registro) | ✅ completata |
| 7 | Test finale, sicurezza, privacy GDPR, guida alla pubblicazione, README, checklist | ✅ completata (pubblicazione da eseguire: docs/PUBBLICAZIONE.md) |
| – | Possibili sviluppi: email di conferma di ogni prenotazione, recupero password docenti via email, comunicazioni a tutti gli studenti | ⏳ |

## Fatto nella Fase 1
- Schema completo: `app_settings`, `students`, `teachers`, `school_days`, `bookings`, `waitlist_entries`, `seat_offers`, `announcements`, `announcement_deliveries`, `audit_log`.
- Trigger: creazione profili (solo studenti Google del dominio, docenti da app_metadata), capienza atomica con `FOR UPDATE`, regole delle giornate, `updated_at`, registro operazioni.
- RLS su tutte le tabelle + funzioni `is_teacher`, `current_app_role`, `get_day_availability`, `generate_school_days`.
- Calendario generato: 145 giornate feriali.
- Next.js: client Supabase (browser/server/admin/proxy), `proxy.ts`, DAL `getCurrentUser`/`requireRole`, `/auth/callback`, pagine `/`, `/accesso`, `/studente`, `/docenti`, `/stato`, `/api/health`, 404; componenti UI riutilizzabili; font locali.
- Script `teacher:create`, `db:test`; README, `.env.example`, documento di architettura.

## Fatto nella Fase 2
- Identità visiva: blu istituzionale, bianco, legno e oro; token in `src/app/globals.css`; marchio (arco della volta + libri) in `components/brand` e `app/icon.svg`.
- Fotografia della biblioteca: originale in `assets/originale/`, versioni web in `src/assets/` (verticale e panorama), servite da `next/image` (AVIF/WebP, segnaposto sfocato) tramite `components/media/LibraryPhoto.tsx` con overlay per la leggibilità. Usata in homepage, accesso studenti, accesso docenti, copertina area personale, barra laterale docenti, immagine social (`app/opengraph-image.jpg`).
- Pagine reali: homepage, `/accesso` (studenti, Google), `/accesso/docenti`; strutture delle aree riservate `StudentShell` (barra inferiore su smartphone) e `TeacherShell` (barra laterale su desktop), con tutte le sottopagine che dichiarano la fase in cui verranno collegate.
- Componenti riutilizzabili: Button, Card, Badge, Notice, Field/TextInput/Select/Toggle, Sheet, Toast, SeatMeter, StatCard, BarChart/HBarList, EmptyState, Avatar, MonthCalendar (solo lun–ven), DayCard, BookingCard, WaitlistCard, BookConfirmSheet.
- Viste pronte da collegare ai dati reali (ricevono dati e azioni come props): `components/student/views/*`, `components/teacher/views/*`.
- Logica condivisa: `lib/calendar.ts` (griglia mensile, livelli di disponibilità), `lib/booking-rules.ts` (scadenza annullamento 24 h con fuso Europe/Rome).
- Anteprima `/anteprima/*` con dati dimostrativi (`lib/demo/*`), fascia dorata "Anteprima con dati dimostrativi", attiva in sviluppo e in produzione solo con `ENABLE_UI_PREVIEW=true`. Le azioni modificano solo lo stato nel browser.

## Fatto nella Fase 3
- **Studenti, solo Google**: `startGoogleSignIn` (Server Action, PKCE, `hd` + `prompt=select_account`) → Supabase Auth → `/auth/callback`. Rifiuto lato server: trigger `handle_new_auth_user` (dominio esatto `@stud.liceovoltacomo.edu.it`, provider Google, `email_verified`) e controlli nel callback sull'utente restituito dallo scambio del codice; un docente che usa Google viene disconnesso.
- **Registrazione iniziale** `/registrazione`: nome, cognome (precompilati da Google), classe (anno 1–5 + sezione); email dall'account Google, non modificabile e mai letta dal modulo; salvataggio con la funzione `complete_student_registration` (solo la propria riga, una volta sola).
- **Area personale reale** `/studente`: «Benvenuto, Nome Cognome», sezioni Le mie prenotazioni, Le mie liste d'attesa, Comunicazioni, lette dal database con la RLS (vuote fino alle fasi 4–7).
- **Docenti, solo email e password**: `/accesso/docenti` con Server Action, messaggio d'errore unico, blocco dopo 5 errori in 15 minuti per email (20 per IP) in `auth_attempts`; account solo da email pre-autorizzate (`teacher_invitations`); password iniziale da `TEACHER_INITIAL_PASSWORD`, cambio obbligatorio al primo accesso in `/docenti/password` (verifica della password attuale, ≥ 10 caratteri con lettere e numeri, diversa dall'iniziale); script `teacher:create` e `teacher:reset-password`.
- **Sessione**: cookie httpOnly, Secure in produzione, SameSite=Lax; logout (`signOut`) negli shell e nelle pagine di accesso; intestazioni di sicurezza in `next.config.ts`.
- **Autorizzazioni**: il proxy legge ruolo, metodo di accesso (`amr`), registrazione e cambio password e reindirizza prima del rendering (`lib/auth/routing.ts`); `requireRole` ripete i controlli nei layout; `/api/me` come API protetta; RLS invariata e nuove funzioni riservate al service role.
- **Migrazione 5** `…_auth_registration.sql`. Docenti spostati nel gruppo `app/docenti/(area)`; rimosso il client Supabase del browser (non più necessario con i cookie httpOnly).
- **Test**: stack Supabase locale senza Docker (`scripts/local-stack/stack.mjs`: PostgreSQL 17, Supabase Auth v2.180.0, PostgREST v12.2.3) e provider OpenID di prova al posto di Google (`mock-google.mjs`); `npm run test:auth` guida l'app reale con Chrome.

## Fatto nella Fase 4
- **Migrazione 6** `…_bookings.sql`: festività nazionali feriali chiuse (8/12, 25/12, 1/1, 6/1, 29/3, 2/6); funzioni `book_seat` (blocco `FOR UPDATE` della giornata, mai più di 50, una sola prenotazione attiva per studente e giornata, solo studenti registrati, solo giornate aperte e prima dell'apertura), `cancel_booking` (solo le proprie, fino a 24 ore prima dell'apertura), `my_bookings`, `set_opening_hours` (docenti), `school_today`, `day_opening_at`, `cancellation_deadline` (fuso Europe/Rome calcolato da PostgreSQL: ora solare e legale).
- **Stati** DISPONIBILE / QUASI COMPLETA (≤ 5 posti, evidenziata) / COMPLETA / CHIUSA (`STATUS_LABEL` in `lib/calendar.ts`); messaggio della 51ª prenotazione identico a quello richiesto.
- **Studenti**: calendario mensile reale `/studente/calendario` (scheda con data, giorno, prenotazioni, posti disponibili, stato), conferma in due passaggi con i dati presi dal profilo e conferma a schermo; `/studente` e `/studente/prenotazioni` con prenotazioni future, data della prenotazione, stato, annullamento con conferma e pulsante disattivato dopo la scadenza.
- **Server Actions** `app/studente/actions.ts` (`bookSeat`, `cancelBooking`) + `refresh()`: calendario e area personale si aggiornano subito; `useLiveClock` ricarica i dati ogni 30 s e al ritorno sulla pagina, così si vedono anche le prenotazioni degli altri.
- **Docenti**: dashboard reale con occupazione delle prossime giornate e modulo «Orario dell'aula studio» (`set_opening_hours`).
- Le viste dell'anteprima (`/anteprima`) usano gli stessi componenti; i dati dimostrativi restano solo lì.

## Fatto nella Fase 5
- **Migrazione 7** `…_waitlist.sql`: `offer_minutes` (predefinito 120, 15–720) in `app_settings`; `waitlist_paused` per giornata; `queue_seq` (ordine cronologico rigoroso) ed `end_reason` nelle iscrizioni; `token_hash`, `used_at`, `end_reason` nelle proposte; coda email `notification_outbox` (solo service role).
- **Logica nel database** (atomica, ordine dei blocchi giornata → proposta): `join_waitlist` (solo con giornata piena, prima della soglia delle 24 ore, lista attiva, niente duplicati), `leave_waitlist`, `my_waitlist` (posizione, totale, proposte), `process_day_waitlist` (proposta al primo in coda con token casuale di 244 bit salvato solo come hash SHA-256, il posto resta trattenuto), `accept_my_offer` / `accept_offer_by_token` (uso singolo, scadenza, limite 50), `decline_*`, `run_waitlist_maintenance` (scadenze → successivo; nessuna nuova proposta dopo la soglia delle 24 ore), trigger su annullamento e sui cambi della giornata (chiusura: proposte annullate e avvisi; riapertura/capienza/riattivazione: nuove proposte), `book_seat` aggiornata (conta i posti proposti), funzioni docenti `set_waitlist_paused`, `teacher_remove_waitlist_entry`, `set_offer_minutes`, `get_day_availability` con `held`, `waiting`, `waitlist_open`.
- **Automazione**: Supabase Cron (`pg_cron`, ogni minuto) esegue `run_waitlist_maintenance`; `/api/cron/notifications` (protetta da `CRON_SECRET`) esegue la manutenzione e invia le email; le azioni dell'app inviano subito con `after()`. Nessun timer nel browser.
- **Email** (`lib/email/templates.ts`, `lib/email/outbox.ts`): proposta con link personale e scadenza, conferma, proposta scaduta, giornata chiusa (prenotati e in lista). Presa in carico atomica (`claim_notifications`), token in chiaro cancellato dopo l'invio.
- **Link personale** `/proposta/[token]`: conferma o rinuncia solo con pulsante (POST), anche senza accesso; link non valido, già usato, scaduto o annullato gestiti.
- **Studenti**: pulsante «ISCRIVITI ALLA LISTA D'ATTESA» sulle giornate complete, posizione nella scheda, conferma/rinuncia dal calendario; sezione «Le mie liste d'attesa» reale `/studente/attesa` (posizione su totale, data di iscrizione, proposte da confermare, uscita, storico delle proposte); riepilogo nell'area personale.
- **Docenti**: nuova voce «Lista d'attesa» `/docenti/lista-attesa` (in attesa, proposte aperte e scadute, code per giornata in ordine cronologico, rimozione, sospensione/riattivazione, tempo di conferma); calendario gestionale reale `/docenti/calendario` (chiusura con motivo, capienza, note).

## Fatto nella Fase 7
- **Migrazione 9** `…_privacy_retention.sql`: registro tecnico senza dati personali (anche righe pregresse), foto e altri metadati Google non conservati (`auth.users`, `auth.identities`), inviti docenti validi 30 minuti, `export_my_data` (diritto di accesso), `erase_student` (cancellazione con anonimizzazione del registro e posto alla lista d'attesa), `purge_expired_data` con tempi in `app_settings` (12 mesi dati delle giornate, 12 mesi profili inattivi, 24 mesi registro, 30 giorni dati tecnici) e job notturno.
- **App**: pagina `/privacy` (bozza di informativa, fonte unica `src/lib/privacy/informativa.ts`), link da accesso, registrazione, piè di pagina e area personale; «Scarica i miei dati» (`/studente/i-miei-dati`); Content Security Policy e COOP; `vercel.json` (regione fra1, cron giornaliero di riserva); script `privacy:export|erase|purge|doc`, `db:backup`.
- **Correzioni dal collaudo**: su smartphone le pagine Iscritti e Comunicazioni scorrevano in orizzontale (griglie senza colonna esplicita, etichetta `sr-only` fuori dal contenitore scorrevole) → corrette senza cambiare la grafica.
- **Nuovi test**: `test:security` (dominio, sessioni, intestazioni e CSP, permessi, API, database tabella per tabella, link, chiavi nei file del browser, privacy), `test:ui` (16 schermate × smartphone/tablet/computer), `test:all` (tutto in sequenza → `docs/TEST_REPORT.md`).
- **Documentazione**: README riscritto, `docs/PUBBLICAZIONE.md`, `docs/PRIVACY_GDPR.md`, `docs/INFORMATIVA_PRIVACY.md`, `docs/CHECKLIST.md`, `docs/TEST_REPORT.md`.

## Fatto nella Fase 6
- **Migrazione 8** `…_teacher_dashboard.sql`: `announcements` con destinatari scelti (`include_bookings`, `include_waitlist`, `recipients_count`); coda email collegata all'esito per destinatario (`notification_outbox.delivery_id` → `announcement_deliveries`); funzioni docenti (ricontrollano il ruolo con `require_teacher`): `teacher_update_day` (apertura/chiusura/riapertura, orario, capienza, nota; per la chiusura: avviso automatico, messaggio personalizzato o nessuna email, senza doppi invii), `teacher_cancel_booking` (motivo obbligatorio, email facoltativa, posto alla lista d'attesa), `announcement_recipients_count`, `send_announcement` (prenotati e/o lista d'attesa; oggetto 3–150, testo 5–5000), `retry_announcement`, `teacher_stats`; `complete_notification` registra l'esito di ogni email (inviata/non inviata, id del servizio, errore) e distingue errori temporanei (nuovo tentativo, max 5) da rifiuti definitivi (subito «non inviata»).
- **Registro delle operazioni**: ogni funzione docente scrive `audit_log` (`docente.giornata_chiusa`, `giornata_riaperta`, `orario_giornata`, `giornata_modificata`, `orario_generale`, `prenotazione_annullata`, `comunicazione_inviata`, `comunicazione_reinvio`, `impostazioni`, `lista_sospesa`, `lista_riattivata`, `lista_rimozione`) con dettagli leggibili.
- **Dashboard** `/docenti`: prenotazioni di oggi, studenti iscritti, giornate complete, giornate chiuse, studenti in lista d'attesa; grafico dell'occupazione delle prossime 10 giornate; prossime giornate prenotabili con lista d'attesa; ultime operazioni; pulsante «INVIA COMUNICAZIONE AGLI ISCRITTI».
- **Calendario** `/docenti/calendario`: vista mensile, per giornata iscritti, posti liberi, in lista; chiusura con motivo e **conferma** che mostra prenotati e studenti in lista, scelta della comunicazione (automatica, personalizzata con testo precompilato, nessuna); riapertura con un pulsante; orario e capienza della singola giornata; orario generale (spostato qui dalla dashboard).
- **Iscritti** `/docenti/iscritti?giorno=`: cognome, nome, classe, email, data e ora di prenotazione; ricerca per nome/cognome, filtro per classe, ordinamento (cognome, nome, classe, data); esportazione CSV (UTF-8 con BOM, `;`, protezione dalle formule) ed Excel (`exceljs`) da `/docenti/iscritti/esporta`; annullamento manuale con motivo; prenotazioni annullate e lista d'attesa della giornata.
- **Comunicazioni** `/docenti/comunicazioni`: giornata, destinatari (prenotati e/o lista d'attesa) con conteggio, modelli (annullamento, modifica orario, chiusura straordinaria, avviso urgente), anteprima reale dell'email, conferma con il numero esatto di destinatari calcolato dal database; storico con inviate / non recapitate / in coda, indirizzi e motivi degli errori, «Riprova l'invio»; lo storico si aggiorna da solo finché ci sono email in coda.
- **Statistiche** `/docenti/statistiche`: prenotazioni totali, media giornaliera, occupazione media, studenti in lista, giornate complete, studenti, annullamenti; grafici per settimana e giorno della settimana, giornate più frequentate, classi più rappresentate.
- **Registro** `/docenti/registro` (nuova voce di menu): tutte le operazioni dei docenti raggruppate per giorno, con autore, filtro per tipo e ricerca.
- Anteprime aggiornate (`/anteprima/docenti/*`, nuova `/anteprima/docenti/registro`) con dati dimostrativi separati; finestre di conferma scorrevoli con pulsanti sempre visibili.

## Aggiornamento identità (6/11/2026)
- Logo ufficiale del Liceo A. Volta: originale in `assets/originale/logo-liceo-volta-originale.jpg`, versione web con sfondo trasparente in `src/assets/logo-liceo-volta.png`, componente `components/brand/SchoolLogo.tsx` (sempre su piastrina bianca). Sostituisce il simbolo nel marchio `BrandLockup` (intestazioni, piè di pagina, barre delle aree riservate) e compare in grande nelle schermate di accesso, registrazione e cambio password. L'icona del browser resta il simbolo BIBLIOVOLTA.
- Limite noto: l'originale è piccolo (155×148 px); per stampe o schermi molto grandi servirebbe una versione vettoriale (SVG) o ad alta risoluzione.

## File chiave
`supabase/migrations/*.sql` · `scripts/test-db.ts` · `src/proxy.ts` · `src/lib/auth/session.ts` · `src/lib/supabase/*` · `src/lib/config.ts` · `src/lib/database.types.ts`

## Test eseguiti (6/11/2026)
- Fase 7 (6/11/2026): `npm run test:all` **761/761** — db 191, auth 70, prenotazioni 43, lista d'attesa 71, docenti 77, sicurezza 56, grafica 253; typecheck, lint, build OK. Dettaglio in `docs/TEST_REPORT.md`.
- `npm run db:test`: 38/38 verifiche superate (calendario, profili, anon, docente, studente, capienza, chiusure, registro).
- `npm run typecheck`, `npm run lint`, `npm run build`: nessun errore.
- Server di produzione: `/`, `/accesso`, `/stato` → 200; `/api/health` → 503 senza configurazione (atteso); `/studente` e `/docenti` → redirect a `/accesso?next=…` (con Supabase configurato) o a `/stato` (senza); `/auth/callback` senza codice → redirect con errore.

- Fase 6 (6/11/2026): `npm run db:test` 169/169; nuovo `npm run test:teacher` 77/77 (dashboard, calendario e orario, chiusura con conferma e 53 email personalizzate a prenotati e lista senza doppi avvisi, riapertura, chiusura senza email, iscritti con ricerca/filtro/ordinamento, CSV ed Excel scaricati e verificati, annullamento manuale con email, comunicazione con 10 email consegnate e 1 rifiutata dal servizio registrate per destinatario, nuovo invio, comunicazione alla sola lista d'attesa, controlli di sicurezza via API, statistiche confrontate con il database, registro completo con filtri); `test:waitlist` 71/71, `test:bookings` 43/43, `test:auth` 70/70 rieseguiti; typecheck, lint, build OK.
- Fase 5 (6/11/2026): `npm run db:test` 141/141; `npm run test:waitlist` (scenari: primo in lista, posto liberato, invio proposta, conferma dal link, mancata conferma, passaggio al successivo, rinuncia, cancellazione dalla lista, dashboard docenti, chiusura della giornata, regola delle 24 ore, conferme contemporanee, automazione senza browser, sicurezza del link); test:bookings e test:auth rieseguiti.
- Fase 4 (6/11/2026): `npm run db:test` 98/98; `npm run test:bookings` 43/43 (calendario, informazioni giornaliere, prenotazione normale, ultimo posto, blocco della 51ª anche via API, 20 transazioni simultanee per 3 posti, 70 richieste parallele per 50 posti, duello sull'ultimo posto, duplicati anche simultanei, cancellazione, blocco dopo la scadenza anche via API, ora legale, aggiornamento del calendario per un altro studente, orario cambiato dal docente); `npm run test:auth` 70/70; typecheck, lint, build OK.
- Fase 3 (6/11/2026): `npm run db:test` 67/67; `npm run test:auth` 70/70 (accesso scolastico, 5 tipi di account rifiutati, registrazione, accesso successivo, logout e riuso dei vecchi cookie, docenti con cambio password e blocco tentativi, docente via Google respinto, 15 accessi non autorizzati, 9 controlli sulle API dirette); typecheck, lint, build OK.
- Fase 2 (6/11/2026): typecheck, lint, build OK; 14 pagine × 2 dispositivi (1440 px e 390 px) senza errori in console e senza scorrimento orizzontale; flusso di prenotazione su smartphone verificato (calendario → Prenota il posto → Conferma).

## Limiti noti
- Non ancora pubblicato: le migrazioni sono testate su PostgreSQL 17 con Supabase Auth e PostgREST locali e su PGlite; primo collaudo online da fare seguendo docs/PUBBLICAZIONE.md §11.
- I test grafici usano Chrome con emulazione di iPhone 13 e iPad: va fatta una prova su dispositivi reali (Safari iOS, Android).
- Resend Free consente 100 email al giorno: con chiusure e liste d'attesa frequenti serve il piano a pagamento.
- L'informativa privacy è una bozza: dati del titolare e del RPD da completare e approvare.
- `database.types.ts` scritto a mano: da rigenerare con `supabase gen types` dopo il collegamento.
- Google OAuth reale non ancora provato: nei test Google è sostituito da un provider di prova. Va verificato dopo la configurazione (README, punto 4.5).
- Supabase in produzione rinomina `given_name`/`family_name` di Google: il nome viene precompilato dividendo il nome completo; lo studente può correggerlo.
- Supabase Cron va attivato sul progetto reale (Dashboard → Integrations → Cron) e va pianificata la chiamata a `/api/cron/notifications` (README, punto 5): senza, le email partono solo quando qualcuno usa l'app.
- Le email richiedono un dominio verificato su Resend (`RESEND_API_KEY`, `EMAIL_FROM`); senza configurazione restano in coda e vengono inviate appena configurate.
- Chiudendo una giornata le prenotazioni non vengono annullate (gli studenti sono avvisati); riaprendola tornano valide.
- Il link personale permette di confermare anche senza aver fatto l'accesso: la sicurezza sta nel token (244 bit, uso singolo, scadenza).
- Le prenotazioni sono possibili fino all'orario di apertura della giornata; dopo quell'ora la giornata non è più prenotabile.
- La prenotazione rapida della home dell'anteprima non è ancora riportata nell'area reale (lì c'è il pulsante «Prenota un posto» verso il calendario).
- I docenti che dimenticano la password vanno reimpostati dall'amministratore (`teacher:reset-password`): non c'è ancora il recupero via email.
- Le comunicazioni sono per giornata (prenotati e/o lista d'attesa); non c'è ancora un messaggio a tutti gli studenti registrati.
- Gli studenti non ricevono ancora un'email di conferma per ogni prenotazione (solo per i posti ottenuti dalla lista d'attesa).
- Il servizio di prova sostituisce Resend nei test: con Resend reale verificare il dominio mittente prima del primo invio.
- La fotografia contiene volti di studenti non tutti sfocati: verificare il consenso per la pubblicazione (le inquadrature usate privilegiano volta e scaffali).
- La sorgente della foto è 1152 px di larghezza: su schermi molto grandi risulta leggermente morbida (mitigato dall'overlay).

## Pubblicazione in corso (6/11/2026)
- ✅ Codice su GitHub: LucaComo87/bibliovolta (ramo main).
- ✅ Supabase: progetto in regione Frankfurt, 9 migrazioni eseguite (145 giornate).
- ✅ Google OAuth: client web creato, app «In produzione» (tipo Esterno, senza verifica del brand), collegata a Supabase.
- ✅ Vercel: https://bibliovolta.vercel.app con variabili d'ambiente.
- ✅ Supabase URL Configuration: Site URL e redirect /auth/callback.
- ✅ Verificato online: un account non @stud (docente) viene rifiutato all'accesso studenti con il messaggio corretto.
- ⏳ Account docente amministratore (invito SQL + Add user in Supabase), primo accesso e cambio password.
- ⏳ Prova con un account studente @stud reale (account di prova chiesto al tecnico; verificare eventuale blocco delle app esterne per i minorenni).
- ⏳ Resend (dominio, API key), automazioni Supabase Cron + pg_net, backup, approvazione informativa.

## Prossimo passo operativo
1. Creare l'account docente e accedere a /accesso/docenti.
2. Collaudo con un account @stud di prova.
3. Resend e automazioni (docs/PUBBLICAZIONE.md §4 e §8).

## Come avviare e verificare
```bash
npm install && cp .env.example .env.local
npm run check     # typecheck + lint + test DB + build
npm run test:auth # test end-to-end dell'autenticazione (Linux, root)
npm run test:bookings # test end-to-end delle prenotazioni e della concorrenza (Linux, root)
npm run test:waitlist # test end-to-end della lista d'attesa automatica (Linux, root)
npm run test:teacher  # test end-to-end della dashboard docenti e delle comunicazioni (Linux, root)
npm run test:security # sicurezza e privacy (Linux, root)
npm run test:ui       # grafica su smartphone, tablet e computer (Linux, root)
npm run test:all      # collaudo completo → docs/TEST_REPORT.md
npm run dev       # http://localhost:3000 → /anteprima per le schermate, /stato per la diagnostica
```
