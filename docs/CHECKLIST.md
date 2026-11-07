# BIBLIOVOLTA · Checklist finale

_Aggiornata al 7 novembre 2026, dopo il collaudo completo `npm run test:all` (esito in [`TEST_REPORT.md`](TEST_REPORT.md))._

**Legenda**
- **COMPLETATO** — realizzato e verificato da test automatici che usano la build di produzione e un vero database PostgreSQL con Supabase Auth.
- **DA CONFIGURARE** — il codice è pronto, ma serve un'operazione sui servizi esterni (Supabase, Google, Resend, Vercel, DNS) o una decisione della scuola. Guida: [`PUBBLICAZIONE.md`](PUBBLICAZIONE.md).
- **DA VERIFICARE** — funziona nei test, ma i test usano un sostituto (Google di prova, servizio email di prova, Chrome che simula i dispositivi): va controllato una volta online con i servizi e i dispositivi reali.

Nessuna voce è segnata COMPLETATO senza una verifica automatica superata; la colonna «Verifica» indica dove.

## Prenotazioni

| Funzionalità | Stato | Verifica |
|---|---|---|
| Registrazione studente al primo accesso (nome, cognome, classe; email da Google non modificabile) | COMPLETATO | test:auth, test:security |
| Calendario mensile lun–ven 16/11/2026 – 04/06/2027, festività nazionali chiuse | COMPLETATO | db:test, test:bookings |
| Stati DISPONIBILE / QUASI COMPLETA (≤ 5) / COMPLETA / CHIUSA | COMPLETATO | test:bookings |
| Prenotazione di una giornata con conferma | COMPLETATO | test:bookings |
| 50 studenti prenotati sulla stessa giornata | COMPLETATO | test:bookings, db:test |
| Blocco della 51ª prenotazione con il messaggio richiesto (anche via API diretta) | COMPLETATO | test:bookings |
| Prenotazioni contemporanee (70 richieste per 50 posti, 20 transazioni per 3 posti, duello sull'ultimo posto) | COMPLETATO | test:bookings |
| Impossibilità di prenotare due volte la stessa giornata (anche con richieste simultanee) | COMPLETATO | test:bookings |
| Cancellazione fino a 24 ore prima dell'apertura | COMPLETATO | test:bookings |
| Blocco della cancellazione dopo la scadenza (pulsante disattivato e rifiuto del database) | COMPLETATO | test:bookings |
| Fuso orario Europe/Rome con ora legale | COMPLETATO | test:bookings |
| Aggiornamento del calendario per gli altri studenti senza ricaricare | COMPLETATO | test:bookings |

## Lista d'attesa

| Funzionalità | Stato | Verifica |
|---|---|---|
| Iscrizione dalla giornata COMPLETA («ISCRIVITI ALLA LISTA D'ATTESA») | COMPLETATO | test:waitlist |
| Posizione in ordine cronologico, niente doppioni | COMPLETATO | test:waitlist, db:test |
| Liberazione di un posto → proposta automatica al primo in lista, posto trattenuto | COMPLETATO | test:waitlist |
| Email con link personale (monouso, scadenza, solo impronta SHA-256 nel database) | COMPLETATO | test:waitlist, test:security |
| Conferma entro 2 ore (dal link o dall'area personale) | COMPLETATO | test:waitlist |
| Scadenza della proposta e passaggio al successivo (anche senza utenti collegati) | COMPLETATO | test:waitlist |
| Rinuncia e cancellazione dalla lista, scorrimento delle posizioni | COMPLETATO | test:waitlist |
| Soglia delle 24 ore (nessuna nuova proposta) | COMPLETATO | test:waitlist |
| Chiusura di una giornata con studenti in attesa (proposte annullate, avvisi) | COMPLETATO | test:waitlist, test:teacher |
| Conferme simultanee dello stesso link | COMPLETATO | test:waitlist |
| Email reali consegnate nelle caselle degli studenti | DA VERIFICARE | test con servizio di prova compatibile con Resend |
| Automazione ogni minuto su Supabase Cron + pg_net | DA CONFIGURARE | PUBBLICAZIONE.md §8 |

## Docenti

| Funzionalità | Stato | Verifica |
|---|---|---|
| Accesso riservato con email e password; cambio obbligatorio della password iniziale; blocco dopo 5 errori | COMPLETATO | test:auth |
| Docente con Google e studente con password respinti | COMPLETATO | test:auth |
| Dashboard con prenotazioni del giorno, iscritti, giornate complete e chiuse, lista d'attesa, grafici | COMPLETATO | test:teacher |
| Chiusura di una giornata con conferma, motivo e comunicazione (automatica / personalizzata / nessuna) | COMPLETATO | test:teacher |
| Riapertura di una giornata | COMPLETATO | test:teacher |
| Modifica dell'orario (singola giornata e orario generale) | COMPLETATO | test:teacher, test:bookings |
| Visualizzazione degli iscritti (nome, cognome, classe, email, data e ora) | COMPLETATO | test:teacher |
| Ricerca, filtro per classe, ordinamento | COMPLETATO | test:teacher |
| Cancellazione manuale con motivo ed email allo studente | COMPLETATO | test:teacher |
| Esportazione CSV ed Excel | COMPLETATO | test:teacher |
| Invio email ai prenotati e/o alla lista d'attesa, anteprima, conferma, esito per destinatario, nuovo invio | COMPLETATO | test:teacher |
| Statistiche (totale, media, occupazione, giornate, classi) confrontate con il database | COMPLETATO | test:teacher, db:test |
| Registro delle operazioni con filtri e ricerca | COMPLETATO | test:teacher |
| Gestione lista d'attesa (rimozione, sospensione, tempo per confermare) | COMPLETATO | test:waitlist |
| Docenti di turno: ogni docente prende o lascia il proprio turno | COMPLETATO | test:teacher, db:test |
| Docenti di turno: l'amministratore assegna il turno a qualsiasi docente per nome e cognome | COMPLETATO | test:teacher, db:test |
| Docenti di turno in dashboard (giornate scoperte), elenco iscritti ed Excel | COMPLETATO | test:teacher |
| Creazione degli account dei docenti reali | DA CONFIGURARE | `npm run teacher:create` |

## Sicurezza e privacy

| Funzionalità | Stato | Verifica |
|---|---|---|
| Solo account `@stud.liceovoltacomo.edu.it` verificati (Gmail, altri domini, domini simili, email non verificate respinti) | COMPLETATO | test:auth, test:security |
| Stesso controllo con Google reale e schermata di consenso «Interno» | DA VERIFICARE | PUBBLICAZIONE.md §3 e §11 |
| Sessioni: cookie httpOnly/SameSite, nessun token in JavaScript, logout effettivo, token falsi o scaduti respinti | COMPLETATO | test:auth, test:security |
| Cookie `Secure` e HTTPS | DA VERIFICARE | attivi automaticamente in produzione su Vercel (i test girano in http locale) |
| Separazione dei permessi (pagine, Server Action, funzioni del database) | COMPLETATO | test:auth, test:security |
| Sicurezza delle API (cron con segreto, export protetti, nessuna registrazione esterna, inviti scaduti) | COMPLETATO | test:security |
| Protezione del database (RLS su tutte le tabelle, funzioni interne negate, search_path fisso) | COMPLETATO | test:security, db:test |
| Studenti non vedono dati altrui (tabella per tabella, filtri, scritture dirette) | COMPLETATO | test:security, test:auth |
| Sicurezza dei link della lista d'attesa | COMPLETATO | test:security, test:waitlist |
| Password solo come hash; nessuna chiave nel codice o nei file inviati al browser | COMPLETATO | test:security |
| Intestazioni HTTP (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) senza violazioni | COMPLETATO | test:security |
| Minimizzazione (niente foto Google, registro tecnico senza dati personali) | COMPLETATO | db:test, test:security |
| Conservazione automatica (12 mesi / 24 mesi / 30 giorni, profili inattivi) | COMPLETATO | db:test |
| Download dei propri dati (diritto di accesso) | COMPLETATO | test:security, db:test |
| Cancellazione su richiesta con anonimizzazione del registro | COMPLETATO | db:test |
| Job notturno di conservazione su Supabase Cron | DA CONFIGURARE | PUBBLICAZIONE.md §8 |
| Informativa privacy: `/privacy` e tutti i link portano all'informativa ufficiale della scuola | COMPLETATO | test:security |
| Integrare l'informativa della scuola con BIBLIOVOLTA (fornitori Supabase, Vercel, Resend, tempi di conservazione): testo proposto in `docs/INFORMATIVA_PRIVACY.md` | DA CONFIGURARE | RPD della scuola |
| Accordi con i fornitori (DPA) e registro dei trattamenti | DA CONFIGURARE | PRIVACY_GDPR.md §6, §8 |
| Protezione dalle password già trapelate (Supabase) | DA CONFIGURARE | PUBBLICAZIONE.md §2.3 |

## Grafica

| Funzionalità | Stato | Verifica |
|---|---|---|
| Homepage | COMPLETATO | test:ui |
| Fotografia originale della biblioteca (homepage, accesso, area personale; accesso docenti su schermi grandi) | COMPLETATO | test:ui |
| Logo ufficiale del Liceo | COMPLETATO | test:ui |
| Schermate di accesso studenti e docenti, registrazione | COMPLETATO | test:ui |
| Area studenti (area personale, calendario, prenotazioni, liste d'attesa) | COMPLETATO | test:ui |
| Area docenti (dashboard, calendario, lista d'attesa, iscritti, comunicazioni, statistiche, registro) | COMPLETATO | test:ui |
| Smartphone, tablet e computer senza scorrimento orizzontale, errori o immagini mancanti | COMPLETATO | test:ui (Chrome con emulazione iPhone 13, iPad, 1440 px) |
| Prova su dispositivi reali (Safari su iPhone/iPad, Chrome su Android) | DA VERIFICARE | PUBBLICAZIONE.md §11 |

## Pubblicazione

| Funzionalità | Stato | Verifica |
|---|---|---|
| Build di produzione senza errori; tipi e lint | COMPLETATO | test:all |
| Progetto Supabase (regione UE) e 10 migrazioni | COMPLETATO (migrazione 10 da eseguire) | PUBBLICAZIONE.md §1 |
| Google OAuth (progetto, consenso, client) | DA CONFIGURARE | PUBBLICAZIONE.md §3 |
| Resend (dominio verificato SPF/DKIM/DMARC, API key) | DA CONFIGURARE | PUBBLICAZIONE.md §4 |
| Variabili d'ambiente su Vercel | DA CONFIGURARE | PUBBLICAZIONE.md §5 |
| Pubblicazione su Vercel (`vercel.json` pronto) | DA CONFIGURARE | PUBBLICAZIONE.md §6 |
| Dominio della scuola e HTTPS | DA CONFIGURARE | PUBBLICAZIONE.md §7 |
| Automazioni (lista d'attesa, email, conservazione) | DA CONFIGURARE | PUBBLICAZIONE.md §8 |
| Backup (script pronto; backup automatici con Supabase Pro) | DA CONFIGURARE | PUBBLICAZIONE.md §12 |
| Prova di ripristino di un backup | DA VERIFICARE | PUBBLICAZIONE.md §12 |
| Piani dei fornitori adeguati (limite di 100 email/giorno di Resend Free, pausa di Supabase Free) | DA CONFIGURARE | PUBBLICAZIONE.md §13 |
| Collaudo finale online con account reali | DA VERIFICARE | PUBBLICAZIONE.md §11 |

## Documentazione

| Documento | Stato |
|---|---|
| README completo (descrizione, architettura, database, prenotazioni, lista d'attesa, docenti, configurazioni, aggiornamento) | COMPLETATO |
| Guida alla pubblicazione | COMPLETATO |
| Privacy/GDPR e bozza di informativa | COMPLETATO (informativa da approvare) |
| Rapporto di collaudo | COMPLETATO |
