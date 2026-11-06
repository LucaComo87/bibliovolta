# BIBLIOVOLTA · Privacy e conformità al GDPR

Documento tecnico-organizzativo per il Dirigente Scolastico, il Responsabile della protezione dei dati (RPD/DPO) e l'amministratore del servizio. L'informativa per gli interessati è in `docs/INFORMATIVA_PRIVACY.md` (pagina `/privacy`).

> Le scelte giuridiche (base giuridica, nomine, contratti) vanno confermate dal RPD della scuola. Questo documento descrive come il sistema è stato costruito per rispettarle.

## 1. Principi dell'art. 5 e come sono applicati

| Principio | Applicazione in BIBLIOVOLTA |
|---|---|
| Liceità, correttezza, trasparenza | Informativa su `/privacy`, raggiungibile da homepage, accesso e registrazione; nessun trattamento nascosto, nessun cookie di terze parti né statistiche sui visitatori. |
| Limitazione della finalità | I dati servono solo a prenotazioni, lista d'attesa e comunicazioni di servizio; nessun uso didattico, valutativo o commerciale. |
| Minimizzazione | Studenti: email istituzionale, nome, cognome, classe. Niente foto del profilo Google (rimossa automaticamente dal database), niente telefono, data di nascita o altri dati. Gli studenti vedono di tutti gli altri solo il numero dei posti occupati. Il registro tecnico non contiene nomi, email né impronte dei link. |
| Esattezza | Nome e cognome li conferma lo studente alla registrazione; l'email arriva dall'account della scuola e non è modificabile. Correzioni su richiesta tramite i docenti/amministratore. |
| Limitazione della conservazione | Cancellazione automatica ogni notte (tabella al punto 3). |
| Integrità e riservatezza | Punto 4. |
| Responsabilizzazione | Registro delle operazioni dei docenti, test automatici di sicurezza (`npm run test:security`), questo documento. |

## 2. Inventario dei dati

| Tabella | Contenuto | Chi lo vede |
|---|---|---|
| `students` | email istituzionale, nome, cognome, classe, data di registrazione | lo studente stesso; i docenti |
| `teachers` | email istituzionale, nome e cognome, ruolo | i docenti |
| `bookings` | giornata, stato, data e ora, eventuale motivo di annullamento | lo studente (solo le proprie); i docenti |
| `waitlist_entries`, `seat_offers` | iscrizioni alla lista, proposte di posto, scadenze, impronta SHA-256 del link | lo studente (solo le proprie); i docenti |
| `announcements`, `announcement_deliveries` | comunicazioni dei docenti, esito dell'invio per destinatario | lo studente (solo quelle ricevute); i docenti |
| `notification_outbox` | coda tecnica delle email (indirizzo, testo) | solo il server |
| `audit_log` | registro delle operazioni; per i docenti in forma leggibile | solo i docenti (lettura) |
| `auth_attempts` | tentativi di accesso dei docenti (email, IP, esito) | solo il server |
| `auth.users`, `auth.identities` (Supabase Auth) | account e identità Google (nome, email, verifica), sessioni | solo il server |

Nessun dato rientra nelle categorie particolari dell'art. 9. Gli studenti possono essere minorenni: il servizio non richiede consenso (base giuridica: compito di interesse pubblico, da confermare con il RPD) e tratta il minimo indispensabile.

## 3. Tempi di conservazione

Applicati dalla funzione `purge_expired_data()`, eseguita ogni notte da Supabase Cron (job `bibliovolta-conservazione`). I valori sono nella tabella `app_settings` e si possono cambiare con una riga SQL.

| Dato | Conservazione | Impostazione |
|---|---|---|
| Prenotazioni, iscrizioni alla lista d'attesa, proposte, comunicazioni ed esiti di invio | 12 mesi dalla data della giornata | `retention_months` |
| Profilo studente | cancellato dopo 12 mesi senza alcuna prenotazione o iscrizione (es. dopo il diploma) | `inactive_student_months` |
| Registro delle operazioni | 24 mesi | `audit_retention_months` |
| Coda email inviate/fallite, tentativi di accesso | 30 giorni | `technical_retention_days` |
| Backup | 7 giorni (Supabase Pro) / 30 giorni (copie manuali, cancellate dallo script) | — |

La cancellazione di un profilo elimina a cascata prenotazioni, liste, proposte e comunicazioni ricevute e anonimizza le voci del registro che lo riguardano. Ogni esecuzione lascia nel registro solo i conteggi (`privacy.conservazione`).

## 4. Misure di sicurezza (art. 32)

- **Accesso**: studenti solo con Google e solo `@stud.liceovoltacomo.edu.it` con email verificata (controllo nel database e nel server); docenti solo con email e password, account creati dall'amministratore da inviti validi 30 minuti, cambio obbligatorio della password iniziale, password di almeno 10 caratteri, blocco dopo 5 errori in 15 minuti; un docente non può entrare con Google né uno studente con password.
- **Sessioni**: cookie httpOnly, Secure in produzione, SameSite=Lax; token verificati dal server a ogni richiesta; logout che invalida la sessione.
- **Autorizzazione a tre livelli**: proxy (prima del rendering) → controllo del ruolo nelle pagine e nelle Server Action → Row Level Security su tutte le tabelle e funzioni del database che ricontrollano il ruolo.
- **Database**: RLS attiva su tutte le tabelle; funzioni privilegiate con `search_path` fisso e permessi revocati ad anonimi; operazioni critiche (capienza, lista d'attesa) atomiche con blocchi di riga.
- **Link della lista d'attesa**: 256 bit casuali, monouso, con scadenza; nel database solo l'impronta SHA-256; la conferma richiede un clic (aprire il link non basta).
- **Chiavi**: solo in variabili d'ambiente (Vercel, Supabase Vault per il cron); nessuna chiave nel codice né nei file inviati al browser (verificato dai test).
- **Trasporto e browser**: HTTPS obbligatorio (HSTS), Content Security Policy restrittiva, protezione da framing, `nosniff`, nessuna intestazione che riveli la tecnologia.
- **Esportazioni**: l'elenco iscritti (CSV/Excel) è scaricabile solo dai docenti; le celle sono neutralizzate contro l'iniezione di formule. I file scaricati vanno conservati solo per il tempo necessario.
- **Verifica continua**: `npm run test:security` (55+ verifiche) e `npm run test:all` prima di ogni aggiornamento.

## 5. Diritti degli interessati: procedure

| Diritto | Come si esercita |
|---|---|
| Accesso (art. 15) e portabilità (art. 20) | Self-service: area personale → «Scarica i miei dati» (file JSON). In alternativa l'amministratore: `npm run privacy:export -- --email <email>`. |
| Rettifica (art. 16) | Nome, cognome e classe: l'amministratore li corregge in Supabase → *Table Editor → students*. |
| Cancellazione (art. 17) | Su richiesta valutata dalla scuola: `npm run privacy:erase -- --email <email> --conferma`. Elimina profilo, prenotazioni, liste, comunicazioni ricevute, anonimizza il registro; un eventuale posto futuro passa alla lista d'attesa. Nei backup i dati scompaiono alla scadenza della rotazione. |
| Limitazione / opposizione (artt. 18, 21) | Disattivazione del profilo: `students.is_active = false` (non può più prenotare). |

Termine di risposta: un mese (art. 12). Annotare le richieste ricevute nel registro della scuola.

## 6. Fornitori (responsabili del trattamento, art. 28)

| Fornitore | Ruolo | Regione | Azioni richieste |
|---|---|---|---|
| Supabase Inc. | database, autenticazione, cron | eu-central-1 (Francoforte) | accettare il DPA (*Organization → Legal Documents*); scegliere la regione UE |
| Vercel Inc. | hosting dell'applicazione | funzioni in fra1 (Francoforte), CDN globale | accettare il DPA (*Settings → Legal*) |
| Resend | invio email | USA/UE | accettare il DPA; dominio mittente della scuola |
| Google | autenticazione degli studenti | secondo Google Workspace for Education | verificare che rientri nel contratto Workspace già in essere |

Trasferimenti extra UE: per i fornitori statunitensi verificare la certificazione EU-US Data Privacy Framework e/o le clausole contrattuali standard incluse nei rispettivi DPA.

## 7. Violazioni dei dati (artt. 33–34)

In caso di sospetto accesso non autorizzato:
1. Revocare subito le chiavi compromesse: Supabase → *API Keys → Roll*; Resend → elimina la chiave; nuovo `CRON_SECRET` (Vercel + Vault). Ridistribuire le variabili su Vercel e ripubblicare.
2. Chiudere tutte le sessioni aperte: Supabase → *Project Settings → JWT Keys* → ruotare la chiave di firma (tutti dovranno rifare l'accesso).
3. Consultare `audit_log` e i log di Supabase/Vercel per capire perimetro e periodo.
4. Avvisare entro 24 ore il Dirigente e il RPD: la notifica al Garante va fatta entro 72 ore se c'è rischio per gli interessati.

## 8. Scheda per il registro dei trattamenti (art. 30)

- **Denominazione**: Prenotazione dell'aula studio della biblioteca (BIBLIOVOLTA)
- **Titolare**: Liceo A. Volta di Como, Dirigente Scolastico pro tempore — **RPD**: [da completare]
- **Finalità**: organizzazione dell'accesso all'aula studio (prenotazioni, lista d'attesa, comunicazioni di servizio)
- **Base giuridica**: art. 6.1.e GDPR, art. 2-ter D.Lgs. 196/2003 [da confermare]
- **Interessati**: studenti dell'istituto; docenti incaricati
- **Categorie di dati**: dati identificativi e di contatto istituzionali, classe, prenotazioni; dati tecnici di accesso dei docenti
- **Destinatari**: personale autorizzato; responsabili esterni Supabase, Vercel, Resend, Google
- **Trasferimenti extra UE**: possibili verso USA con garanzie art. 45/46
- **Conservazione**: tabella al punto 3
- **Misure di sicurezza**: punto 4
