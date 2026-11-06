# BIBLIOVOLTA · Guida alla pubblicazione

Guida passo per passo per mettere online BIBLIOVOLTA con **Supabase** (database e accesso), **Google** (accesso studenti), **Resend** (email) e **Vercel** (sito). Tempo stimato: 2–3 ore, più i tempi di propagazione DNS.

Servono: un account amministratore del **Google Workspace della scuola**, accesso alla gestione **DNS** del dominio `liceovoltacomo.edu.it` (di solito il tecnico o il fornitore del sito della scuola), un account GitHub per il codice.

> Prima di aprire il servizio agli studenti va **approvata l'informativa privacy** (punto 10) e vanno firmati gli accordi con i fornitori (docs/PRIVACY_GDPR.md).

---

## Indice

1. [Creazione del progetto Supabase](#1-creazione-del-progetto-supabase)
2. [Configurazione dell'accesso su Supabase](#2-configurazione-dellaccesso-su-supabase)
3. [Configurazione di Google OAuth](#3-configurazione-di-google-oauth)
4. [Configurazione di Resend](#4-configurazione-di-resend)
5. [Variabili d'ambiente](#5-variabili-dambiente)
6. [Pubblicazione su Vercel](#6-pubblicazione-su-vercel)
7. [Configurazione del dominio](#7-configurazione-del-dominio)
8. [Automazioni](#8-automazioni)
9. [Account dei docenti](#9-account-dei-docenti)
10. [Prima dell'apertura: privacy](#10-prima-dellapertura-privacy)
11. [Collaudo finale online](#11-collaudo-finale-online)
12. [Backup del database](#12-backup-del-database)
13. [Costi e limiti dei piani gratuiti](#13-costi-e-limiti-dei-piani-gratuiti)

---

## 1. Creazione del progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → *Start your project* e accedi (meglio con un account intestato alla scuola, non personale).
2. *New organization* (es. «Liceo A. Volta Como») → *New project*:
   - **Name**: `bibliovolta`
   - **Database password**: generane una lunga con il pulsante *Generate* e **conservala in un luogo sicuro** (serve per i backup).
   - **Region**: **Central EU (Frankfurt) – eu-central-1** (dati in Unione Europea, richiesto dall'informativa).
3. Attendi la creazione (1–2 minuti). In *Project Settings → General* annota il **Reference ID** (la parte `xxxx` di `https://xxxx.supabase.co`).
4. Applica le **9 migrazioni** di `supabase/migrations/`, nell'ordine dei nomi. Due modi:
   - **SQL Editor** (più semplice): *SQL Editor → New query*, apri il file `20261106000001_schema.sql`, copia tutto il contenuto, incolla e premi *Run*. Ripeti per `…0002` fino a `…0009`. Ogni esecuzione deve terminare con *Success*.
   - **CLI**: dalla cartella del progetto
     ```bash
     npx supabase login
     npx supabase link --project-ref <REFERENCE_ID>
     npx supabase db push
     ```
5. Controlla in *Table Editor*: la tabella `school_days` deve avere **145 righe** (dal 16/11/2026 al 04/06/2027; le festività nazionali sono già chiuse).
6. *Project Settings → API Keys*: copia
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_…`, oppure la *service_role* nei progetti meno recenti) → `SUPABASE_SERVICE_ROLE_KEY`. **Non condividerla mai e non inserirla nel codice.**

## 2. Configurazione dell'accesso su Supabase

*Authentication* nel menu a sinistra:

1. **URL Configuration**
   - *Site URL*: l'indirizzo definitivo, es. `https://bibliovolta.liceovoltacomo.edu.it` (finché il dominio non è pronto, quello di Vercel, es. `https://bibliovolta.vercel.app`).
   - *Redirect URLs*: aggiungi `https://<dominio>/auth/callback`, `https://bibliovolta.vercel.app/auth/callback` e, per lo sviluppo, `http://localhost:3000/auth/callback`.
2. **Sign In / Providers**
   - *Allow new users to sign up*: **attivo** (serve al primo accesso Google degli studenti; il database rifiuta comunque ogni account che non sia del dominio scolastico).
   - *Confirm email*: **attivo** (impostazione predefinita). I docenti sono creati già confermati dallo script; chiunque provi a registrarsi da solo con email e password viene rifiutato dal database.
   - *Allow manual linking*: **disattivo**.
   - *Email*: attivo (serve ai docenti). *Google*: lo attiverai al punto 3.
3. **Policies → Passwords** (se disponibile): lunghezza minima **10**, *lettere e numeri*, *Prevent use of leaked passwords* attivo.
4. **Rate Limits**: lascia i valori predefiniti (l'app aggiunge il blocco dopo 5 errori in 15 minuti per email e 20 per IP).
5. **Emails → SMTP Settings** (consigliato): usa Resend come SMTP di Supabase (`smtp.resend.com`, porta 465, utente `resend`, password = API key) così anche le eventuali email di sistema di Supabase partono dal dominio della scuola.

## 3. Configurazione di Google OAuth

Da fare con un **account amministratore del Google Workspace** della scuola.

1. [console.cloud.google.com](https://console.cloud.google.com) → selettore dei progetti → *Nuovo progetto* → nome `BIBLIOVOLTA`, organizzazione `liceovoltacomo.edu.it`.
2. *Google Auth Platform* (o *API e servizi → Schermata di consenso OAuth*) → *Inizia*:
   - **Nome app**: `BIBLIOVOLTA`; **email di assistenza**: quella del referente.
   - **Pubblico**: **Interno** se il dominio `stud.liceovoltacomo.edu.it` appartiene allo stesso Workspace (Google stesso bloccherà gli account esterni). Se gli studenti sono in un Workspace separato, scegli **Esterno** e poi *Pubblica app*: il blocco resta garantito dal server e dal database.
   - **Domini autorizzati** (*Branding*): `supabase.co` e il dominio del sito (`liceovoltacomo.edu.it` e/o `vercel.app`).
   - **Accesso ai dati / ambiti**: solo `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (nessun ambito sensibile).
3. *Client* → *Crea client* → tipo **Applicazione web**, nome `BIBLIOVOLTA web`:
   - **Origini JavaScript autorizzate**: `https://<dominio>`, `https://bibliovolta.vercel.app`, `http://localhost:3000`
   - **URI di reindirizzamento autorizzati**: `https://<REFERENCE_ID>.supabase.co/auth/v1/callback` (lo trovi anche in Supabase → *Providers → Google → Callback URL*)
4. Copia **ID client** e **Client secret**.
5. Supabase → *Authentication → Sign In / Providers → Google* → **Enable**, incolla *Client ID* e *Client Secret*, *Save*. Lascia vuoto *Authorized Client IDs* e disattivo *Skip nonce checks*.
6. Se in futuro il segreto viene rigenerato su Google, aggiornalo anche qui.

## 4. Configurazione di Resend

1. [resend.com](https://resend.com) → crea l'account (della scuola) → *Domains → Add domain*: usa un sottodominio dedicato, es. `mail.liceovoltacomo.edu.it` oppure `liceovoltacomo.edu.it`; regione **EU (Ireland)** se proposta.
2. Resend mostra i record DNS da creare (**SPF** `TXT`, **DKIM** `TXT`/`CNAME`, **MX** per il rimbalzo). Passali a chi gestisce il DNS della scuola; aggiungi anche un record **DMARC** (`_dmarc` → `v=DMARC1; p=none; rua=mailto:<email del referente>`).
3. Attendi lo stato **Verified** (da pochi minuti a 24 ore).
4. *API Keys → Create API key*: nome `bibliovolta-produzione`, permesso **Sending access**, limitata al dominio verificato. Copiala in `RESEND_API_KEY`.
5. `EMAIL_FROM`: un indirizzo del dominio verificato, es. `BIBLIOVOLTA <bibliovolta@liceovoltacomo.edu.it>`. Se gli studenti possono rispondere, crea la casella o un inoltro verso il referente.
6. Verifica il piano: quello gratuito consente **100 email al giorno** (vedi punto 13).

## 5. Variabili d'ambiente

Le chiavi non sono mai nel codice. In sviluppo stanno in `.env.local` (copia di `.env.example`, esclusa da git); in produzione su **Vercel → Project → Settings → Environment Variables**, ambiente *Production* (e *Preview* se usi deploy di prova con un altro progetto Supabase).

| Variabile | Dove si trova | Esempio | Note |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → API Keys | `https://abcd1234.supabase.co` | pubblica |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys | `sb_publishable_…` | pubblica, protetta dalla RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys (Secret) | `sb_secret_…` | **segreta**, solo server |
| `NEXT_PUBLIC_SITE_URL` | il tuo dominio | `https://bibliovolta.liceovoltacomo.edu.it` | usato nei link delle email |
| `RESEND_API_KEY` | Resend → API Keys | `re_…` | **segreta** |
| `EMAIL_FROM` | dominio verificato in Resend | `BIBLIOVOLTA <bibliovolta@liceovoltacomo.edu.it>` | |
| `CRON_SECRET` | generalo tu: `openssl rand -hex 32` | 64 caratteri esadecimali | **segreto**, uguale nel cron di Supabase |
| `TEACHER_INITIAL_PASSWORD` | decisa dalla scuola | (comunicata ai docenti a voce) | **segreta**; serve agli script e al controllo «non riusare la password iniziale» |
| `ENABLE_UI_PREVIEW` | — | `false` | in produzione lasciare `false` |

Dopo ogni modifica alle variabili su Vercel serve un nuovo deploy (*Deployments → … → Redeploy*): le variabili `NEXT_PUBLIC_*` vengono incorporate al momento della build.

## 6. Pubblicazione su Vercel

1. Carica il progetto su un repository **privato** GitHub (senza `.env.local`, già escluso da `.gitignore`).
2. [vercel.com](https://vercel.com) → *Add New → Project* → importa il repository. Framework: **Next.js** (rilevato automaticamente); comandi predefiniti (`npm install`, `npm run build`).
3. Inserisci le variabili del punto 5 → *Deploy*.
4. Il file `vercel.json` imposta la regione delle funzioni su **Francoforte (fra1)**, vicina al database, e un controllo giornaliero di riserva su `/api/cron/notifications` (Vercel invia automaticamente `Authorization: Bearer <CRON_SECRET>`).
5. Apri `https://<progetto>.vercel.app/stato`: tutte le voci devono essere verdi e il database deve risultare raggiungibile con 145 giornate.
6. Da qui in poi ogni push sul ramo `main` ripubblica il sito; ogni pull request genera un'anteprima.

## 7. Configurazione del dominio

1. Vercel → *Project → Settings → Domains → Add*: es. `bibliovolta.liceovoltacomo.edu.it`.
2. Vercel indica il record DNS: per un sottodominio un **CNAME** `bibliovolta` → `cname.vercel-dns.com` (o il valore specifico mostrato). Chiedi al gestore del DNS della scuola di crearlo.
3. Attendi lo stato *Valid Configuration*: il certificato HTTPS viene emesso automaticamente.
4. Imposta il dominio come *Primary* e attiva il reindirizzamento da `*.vercel.app`.
5. **Aggiorna ovunque il nuovo indirizzo**:
   - Vercel: `NEXT_PUBLIC_SITE_URL` → redeploy;
   - Supabase: *Site URL* e *Redirect URLs* (punto 2.1);
   - Google Cloud: *Origini JavaScript autorizzate* (punto 3.3);
   - Supabase Vault: il segreto `bibliovolta_site_url` del cron (punto 8.2).

## 8. Automazioni

Tre attività girano da sole, anche quando nessuno usa il sito:

| Attività | Frequenza | Dove |
|---|---|---|
| Scadenza delle proposte della lista d'attesa e passaggio al successivo | ogni minuto | Supabase Cron → `run_waitlist_maintenance()` |
| Invio delle email in coda | ogni minuto | Supabase Cron → `pg_net` → `/api/cron/notifications` |
| Cancellazione dei dati scaduti (privacy) | ogni notte alle 03:17 UTC | Supabase Cron → `purge_expired_data()` |

1. Supabase → *Integrations → Cron* → **Enable** (estensione `pg_cron`). *Database → Extensions* → attiva anche **`pg_net`**.
2. *SQL Editor*, esegui una volta (sostituisci indirizzo e segreto):
   ```sql
   -- segreti nel Vault cifrato di Supabase (mai in chiaro nei job)
   select vault.create_secret('https://bibliovolta.liceovoltacomo.edu.it', 'bibliovolta_site_url');
   select vault.create_secret('<CRON_SECRET>', 'bibliovolta_cron_secret');

   -- lista d'attesa (se la migrazione 7 è stata eseguita prima di attivare pg_cron)
   select cron.schedule('bibliovolta-waitlist', '* * * * *', 'select public.run_waitlist_maintenance()');

   -- invio delle email
   select cron.schedule('bibliovolta-email', '* * * * *', $$
     select net.http_get(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'bibliovolta_site_url') || '/api/cron/notifications',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bibliovolta_cron_secret')),
       timeout_milliseconds := 20000
     ) $$);

   -- conservazione dei dati (se la migrazione 9 è stata eseguita prima di attivare pg_cron)
   select cron.schedule('bibliovolta-conservazione', '17 3 * * *', 'select public.purge_expired_data()');
   ```
   Se un job esiste già, `cron.schedule` con lo stesso nome lo aggiorna.
3. Verifica in *Integrations → Cron → Jobs*: tre job attivi, con esecuzioni *succeeded*. Per l'invio delle email controlla anche `select * from net._http_response order by created desc limit 5;` (stato 200).
4. Per cambiare il segreto: `select vault.update_secret((select id from vault.secrets where name = 'bibliovolta_cron_secret'), '<nuovo>');` e aggiorna `CRON_SECRET` su Vercel.

Le email partono comunque subito dopo ogni azione nell'app; il cron serve per scadenze e invii quando nessuno è collegato.

## 9. Account dei docenti

Sul computer dell'amministratore, nella cartella del progetto, con `.env.local` contenente URL, Secret key e `TEACHER_INITIAL_PASSWORD` del progetto di produzione:

```bash
npm install
npm run teacher:create -- --email nome.cognome@liceovoltacomo.edu.it --name "Nome Cognome" --admin   # primo amministratore
npm run teacher:create -- --email altro.docente@liceovoltacomo.edu.it --name "Altro Docente"         # altri docenti
```

Ogni docente accede da `/accesso/docenti` con la password iniziale e **deve sceglierne una personale** (almeno 10 caratteri, lettere e numeri). Password dimenticata: `npm run teacher:reset-password -- --email …`. Per disattivare un docente: Supabase → *Table Editor → teachers* → `is_active = false`.

## 10. Prima dell'apertura: privacy

1. Far leggere e approvare al Dirigente Scolastico e al RPD/DPO l'informativa (`docs/INFORMATIVA_PRIVACY.md`, pagina `/privacy`); completare le parti tra parentesi quadre in `src/lib/privacy/informativa.ts`, impostare `status: "approvata"` e la data, eseguire `npm run privacy:doc` e ripubblicare.
2. Firmare/accettare gli accordi sul trattamento dei dati (DPA) con Supabase, Vercel e Resend dalle rispettive dashboard (*Legal / DPA*), e verificare che il trattamento rientri nel contratto Google Workspace for Education.
3. Aggiornare il registro dei trattamenti della scuola (scheda pronta in `docs/PRIVACY_GDPR.md`).
4. Comunicare agli studenti e alle famiglie l'avvio del servizio con il link all'informativa.

## 11. Collaudo finale online

Con il sito pubblicato e configurato, in quest'ordine (circa 30 minuti):

1. `/stato`: tutto verde.
2. Accesso con un account **studente reale** → registrazione → prenotazione di una giornata → arrivo nell'area personale.
3. Accesso con un **Gmail personale** → messaggio «account non autorizzato».
4. Accesso **docente** → cambio password → dashboard; chiusura di una giornata di prova con «Non inviare email» e riapertura.
5. Comunicazione di prova a una giornata con solo il proprio account prenotato → email ricevuta, storico «1 inviata».
6. Lista d'attesa: con un secondo account di prova (o abbassando temporaneamente la capienza di una giornata a 1 dal calendario docenti) iscriversi, annullare con il primo account, ricevere l'email con il link e confermare.
7. Esportazione CSV/Excel dell'elenco iscritti.
8. *Integrations → Cron → Jobs*: esecuzioni riuscite.
9. Cancellare le prenotazioni di prova (o lasciare che lo faccia la conservazione automatica).

## 12. Backup del database

**Automatici (consigliato)**: con il piano **Supabase Pro** il database è salvato ogni giorno e le copie degli ultimi 7 giorni si ripristinano da *Database → Backups*; con l'add-on *Point in Time Recovery* si torna a qualsiasi minuto. Sul piano gratuito non ci sono backup scaricabili.

**Manuali (in ogni caso, almeno una volta alla settimana e prima di ogni aggiornamento)**:

1. Installa gli strumenti di PostgreSQL 15+ (`pg_dump`).
2. Supabase → *Project Settings → Database → Connection string → Session pooler*: copia la stringa e sostituisci la password del database.
3. ```bash
   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" npm run db:backup
   ```
   Crea `backups/bibliovolta-AAAA-MM-GG-HHMM.sql.gz` e cancella le copie più vecchie di 30 giorni.
4. Il file contiene **dati personali**: conservalo su un disco cifrato o in uno spazio della scuola ad accesso ristretto; non inviarlo per email.

**Ripristino** (su un progetto nuovo o dopo un incidente): crea un progetto Supabase vuoto nella stessa regione, poi
```bash
gunzip -c backups/bibliovolta-AAAA-MM-GG-HHMM.sql.gz | psql "<connection string del nuovo progetto>"
```
quindi aggiorna le variabili su Vercel e ripeti i punti 2, 3 (provider Google) e 8. Prova il ripristino almeno una volta all'inizio dell'anno scolastico.

## 13. Costi e limiti dei piani gratuiti

Verificare sempre i listini aggiornati sui siti dei fornitori.

- **Supabase Free**: sufficiente per dimensioni (500 MB di database), ma **senza backup** e con **sospensione del progetto dopo 7 giorni senza attività** (es. vacanze estive: si riattiva dalla dashboard). Per un servizio scolastico è consigliato **Pro**.
- **Vercel Hobby**: pensato per uso personale non commerciale; per un servizio della scuola valutare **Pro** o verificare le condizioni d'uso. I cron del piano Hobby sono solo giornalieri (per questo la pianificazione al minuto è su Supabase).
- **Resend Free**: 3.000 email al mese e **100 al giorno**. Una chiusura con 50 prenotati e alcuni studenti in lista consuma da sola oltre la metà della quota giornaliera: con un uso regolare serve il piano a pagamento. Le email oltre il limite restano in coda (stato «in coda»/«non recapitata») e si possono rimandare dallo storico.
