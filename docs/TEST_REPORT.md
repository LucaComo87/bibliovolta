# BIBLIOVOLTA · Rapporto di collaudo

_Eseguito il 7 novembre 2026 alle ore 10:00 con `npm run test:all`. Ambiente: build di produzione Next.js, PostgreSQL 17 + Supabase Auth + PostgREST in locale, Chrome, Google e Resend sostituiti da servizi di prova._

| Prova | Esito | Verifiche | Durata |
|---|---|---|---|
| Controllo dei tipi TypeScript | ✅ superata | — | 2 s |
| Lint (ESLint) | ✅ superata | — | 6 s |
| Database: migrazioni, regole, permessi, privacy | ✅ superata | 213/213 | 2 s |
| Build di produzione | ✅ superata | — | 4 s |
| Autenticazione e registrazione | ✅ superata | 70/70 | 54 s |
| Calendario e prenotazioni | ✅ superata | 43/43 | 24 s |
| Lista d'attesa automatica | ✅ superata | 71/71 | 23 s |
| Dashboard docenti e comunicazioni | ✅ superata | 95/95 | 37 s |
| Sicurezza e privacy | ✅ superata | 56/56 | 20 s |
| Grafica su smartphone, tablet e computer | ✅ superata | 298/298 | 121 s |

**Totale: 846/846 verifiche superate.**

## Database: migrazioni, regole, permessi, privacy

- ✅ migrazione 20261106000001_schema.sql
- ✅ migrazione 20261106000002_functions_triggers.sql
- ✅ migrazione 20261106000003_rls.sql
- ✅ migrazione 20261106000004_calendar_seed.sql
- ✅ migrazione 20261106000005_auth_registration.sql
- ✅ migrazione 20261106000006_bookings.sql
- ✅ migrazione 20261106000007_waitlist.sql
- ✅ migrazione 20261106000008_teacher_dashboard.sql
- ✅ migrazione 20261106000009_privacy_retention.sql
- ✅ migrazione 20261107000010_supervision_shifts.sql
- ✅ calendario: prima giornata 2026-11-16
- ✅ calendario: ultima giornata 2027-06-04
- ✅ calendario: nessun sabato/domenica
- ✅ calendario: 145 giornate feriali generate
- ✅ calendario: 50 posti, 14:15–16:30
- ✅ calendario: sabato rifiutato
- ✅ calendario: giorno fuori stagione rifiutato
- ✅ profili: studenti creati automaticamente dal dominio
- ✅ profili: docente creato solo da email pre-autorizzata
- ✅ profili: invito consumato
- ✅ profili: email esterna rifiutata
- ✅ profili: email studente senza Google rifiutata
- ✅ profili: account email+password non invitato rifiutato
- ✅ anon: nessun accesso alle giornate
- ✅ anon: nessun accesso agli studenti
- ✅ anon: nessun accesso alla disponibilità
- ✅ docente: ruolo riconosciuto
- ✅ docente: può inserire prenotazioni
- ✅ docente: doppia prenotazione stesso giorno rifiutata
- ✅ capienza: oltre il limite rifiutato
- ✅ capienza: non si può scendere sotto i posti prenotati
- ✅ chiusura: prenotazione in giornata chiusa rifiutata
- ✅ registro: operazioni del docente registrate
- ✅ studente: ruolo riconosciuto
- ✅ studente: vede solo il proprio profilo
- ✅ studente: vede solo le proprie prenotazioni
- ✅ studente: non vede i docenti
- ✅ studente: non vede il registro operazioni
- ✅ studente: non può inserire prenotazioni direttamente
- ✅ studente: non può modificare le prenotazioni
- ✅ studente: non può chiudere giornate
- ✅ studente: non può modificare le impostazioni
- ✅ studente: non può scrivere nel registro
- ✅ studente: non può generare giornate
- ✅ disponibilità: conteggi corretti senza dati personali
- ✅ google: email non verificata rifiutata
- ✅ google: account Gmail personale rifiutato
- ✅ google: altro dominio Google rifiutato
- ✅ google: sottodominio ingannevole rifiutato
- ✅ google: dominio come prefisso rifiutato
- ✅ google: doppia chiocciola rifiutata
- ✅ email: uno studente non può passare a un altro dominio
- ✅ docente: cambio password obbligatorio al primo accesso
- ✅ registrazione: vietata agli utenti non autenticati
- ✅ registrazione: classe non valida rifiutata
- ✅ registrazione: nome con caratteri non ammessi rifiutato
- ✅ registrazione: dati salvati e normalizzati
- ✅ registrazione: non ripetibile
- ✅ registrazione: uno studente non modifica i dati di un altro
- ✅ registrazione: nomi con accenti accettati
- ✅ studente: non può segnare cambiata la password di un docente
- ✅ studente: non può leggere i tentativi di accesso
- ✅ studente: non può leggere gli inviti docenti
- ✅ studente: non può auto-invitarsi come docente
- ✅ studente: non può scrivere tentativi di accesso
- ✅ docente: non può azzerare da solo l'obbligo di cambio password
- ✅ tentativi: 4 errori non bloccano
- ✅ tentativi: al 5° errore l'email è bloccata per 15 minuti
- ✅ tentativi: 20 errori dallo stesso IP bloccano l'IP
- ✅ tentativi: un IP diverso non è bloccato
- ✅ tentativi: un accesso riuscito azzera il conteggio
- ✅ server: può segnare la password come cambiata
- ✅ festività: 8 dicembre chiuso fin dall'inizio
- ✅ festività: 6 festività nazionali feriali chiuse
- ✅ orari: scadenza con ora solare (16/11 → 15/11 13:15 UTC)
- ✅ orari: scadenza a cavallo del cambio d'ora (29/3 → 28/3 12:15 UTC)
- ✅ orari: scadenza con ora legale (12/4 → 11/4 12:15 UTC)
- ✅ orari: apertura dopo il ritorno all'ora solare (26/10 14:15 → 13:15 UTC)
- ✅ prenotazione: prenotazione normale riuscita
- ✅ prenotazione: la stessa giornata non si prenota due volte
- ✅ prenotazione: vietata a chi non ha completato la registrazione
- ✅ prenotazione: vietata nelle giornate chiuse
- ✅ prenotazione: vietata agli utenti non autenticati
- ✅ limite: 49 prenotazioni registrate
- ✅ limite: l'ultimo posto (50°) si prenota
- ✅ limite: la 51ª prenotazione è bloccata con il messaggio previsto
- ✅ limite: mai più di 50 prenotazioni attive
- ✅ calendario: la disponibilità mostra 50 prenotati e 0 posti
- ✅ annullamento: entro i termini riuscito
- ✅ annullamento: il posto torna subito disponibile
- ✅ calendario: aggiornato subito dopo l'annullamento
- ✅ annullamento: non si annulla due volte
- ✅ annullamento: il posto liberato può essere preso da un altro
- ✅ annullamento: non si può annullare la prenotazione di un altro
- ✅ prenotazione: dopo l'annullamento la giornata completa resta bloccata
- ✅ scadenza: si può ancora prenotare prima dell'apertura
- ✅ scadenza: my_bookings segnala che non è più annullabile
- ✅ scadenza: l'annullamento dopo il termine è rifiutato dal server
- ✅ area personale: my_bookings restituisce solo le proprie
- ✅ orari: uno studente non può cambiare l'orario
- ✅ orari: orario non valido rifiutato
- ✅ orari: il docente cambia l'orario predefinito e delle giornate future
- ✅ lista: iscrizione rifiutata se ci sono posti liberi
- ✅ lista: posizioni progressive 1, 2, 3
- ✅ lista: iscrizione duplicata rifiutata
- ✅ lista: chi ha già prenotato non si iscrive
- ✅ lista: data e ora di iscrizione registrate in ordine
- ✅ proposta: creata per il primo in lista
- ✅ proposta: scadenza a 2 ore
- ✅ proposta: email in coda con token personale di 64 caratteri
- ✅ proposta: il token non è salvato in chiaro nella tabella delle proposte
- ✅ proposta: il posto è trattenuto (49 prenotati + 1 proposto, 0 liberi)
- ✅ proposta: nessuno può prenotare il posto trattenuto
- ✅ lista: dopo la proposta il secondo diventa 1° in coda, il nuovo iscritto 3°
- ✅ sicurezza: uno studente non può usare la conferma via token
- ✅ sicurezza: uno studente non legge la coda delle email
- ✅ sicurezza: uno studente non avvia la manutenzione
- ✅ sicurezza: uno studente non conferma la proposta di un altro
- ✅ conferma: token sbagliato rifiutato
- ✅ conferma: il link valido assegna il posto
- ✅ conferma: il link non è riutilizzabile
- ✅ conferma: prenotazione registrata e studente tolto dalla lista
- ✅ conferma: email di conferma in coda
- ✅ conferma: 50 prenotazioni attive
- ✅ successivo: proposta al secondo in lista
- ✅ scadenza: la manutenzione fa scadere la proposta
- ✅ scadenza: email di proposta scaduta in coda
- ✅ successivo: proposta automatica al terzo
- ✅ area personale: my_waitlist mostra la proposta ricevuta
- ✅ cancellazione: uscita dalla lista con proposta aperta
- ✅ cancellazione: il posto passa subito al successivo
- ✅ docenti: uno studente non cambia il tempo di conferma
- ✅ docenti: tempo di conferma fuori dai limiti rifiutato
- ✅ docenti: tempo di conferma aggiornato
- ✅ chiusura: la proposta aperta viene annullata
- ✅ chiusura: avviso a tutti i 49 prenotati (1 posto era in proposta)
- ✅ chiusura: avviso agli studenti in lista
- ✅ chiusura: nuove iscrizioni bloccate
- ✅ chiusura: nuove prenotazioni bloccate
- ✅ riapertura: la lista riparte con nuova proposta
- ✅ sospensione: iscrizioni bloccate con lista sospesa
- ✅ email: presa in carico delle notifiche
- ✅ email: una notifica non viene presa due volte
- ✅ email: dopo l'invio il token in chiaro viene cancellato
- ✅ docenti: uno studente non invia comunicazioni
- ✅ docenti: uno studente non annulla prenotazioni altrui
- ✅ docenti: uno studente non chiude giornate
- ✅ docenti: uno studente non legge le statistiche
- ✅ comunicazioni: conteggio destinatari = prenotati
- ✅ comunicazioni: oggetto troppo corto rifiutato
- ✅ comunicazioni: inviata a tutti i prenotati
- ✅ comunicazioni: una email in coda per ogni destinatario
- ✅ registro: invio della comunicazione registrato
- ✅ email: errore temporaneo → nuovo tentativo automatico
- ✅ comunicazioni: esito registrato per destinatario (inviata / non inviata con errore)
- ✅ comunicazioni: nuovo invio dei falliti
- ✅ comunicazioni: lo studente destinatario la vede nell'area personale
- ✅ comunicazioni: chi non è destinatario non la vede
- ✅ annullamento docente: motivo obbligatorio
- ✅ annullamento docente: prenotazione annullata con motivo e autore
- ✅ annullamento docente: email allo studente in coda
- ✅ registro: annullamento manuale registrato
- ✅ chiusura: motivo obbligatorio
- ✅ chiusura: comunicazione personalizzata ai prenotati
- ✅ chiusura: con messaggio personalizzato niente avviso predefinito doppio
- ✅ registro: chiusura registrata con motivo
- ✅ registro: riapertura e cambio orario registrati
- ✅ calendario: giornata riaperta con nuovo orario e nota
- ✅ registro: modifica delle impostazioni registrata
- ✅ statistiche: totale prenotazioni coerente con il database
- ✅ statistiche: occupazione, classi e giornate più frequentate
- ✅ privacy: la foto dell'account Google non viene conservata
- ✅ privacy: il registro tecnico non contiene email e nomi degli studenti
- ✅ privacy: nessuna email nel registro tecnico (anche righe precedenti)
- ✅ sicurezza: gli hash dei link non finiscono nel registro
- ✅ sicurezza: invito docente scaduto (oltre 30 minuti) rifiutato
- ✅ sicurezza: invito docente recente accettato
- ✅ privacy: lo studente scarica i propri dati (profilo e prenotazioni)
- ✅ privacy: l'esportazione personale è solo per gli studenti
- ✅ privacy: esportazione negata ai visitatori anonimi
- ✅ sicurezza: uno studente non può cancellare profili
- ✅ sicurezza: neppure un docente può usare la cancellazione definitiva
- ✅ sicurezza: la pulizia dei dati è riservata al server
- ✅ privacy: cancellazione su richiesta: profilo, prenotazioni e liste eliminati
- ✅ privacy: cancellazione su richiesta: nessuna traccia nel registro
- ✅ conservazione: prenotazioni e liste oltre 12 mesi cancellate
- ✅ conservazione: tentativi di accesso oltre 30 giorni cancellati (i recenti restano)
- ✅ conservazione: coda email oltre 30 giorni cancellata
- ✅ conservazione: registro oltre 24 mesi cancellato
- ✅ conservazione: profili inattivi da oltre 12 mesi cancellati
- ✅ conservazione: l'operazione è registrata senza dati personali
- ✅ conservazione: le giornate del calendario restano
- ✅ turni: un docente prende il turno di una giornata
- ✅ turni: il turno porta il suo nome
- ✅ turni: non si può prendere due volte lo stesso turno
- ✅ turni: un docente non amministratore non assegna turni ad altri
- ✅ turni: nessuna scrittura diretta nella tabella
- ✅ turni: l'amministratore assegna un docente scrivendo nome e cognome
- ✅ turni: nome ripulito e non collegato ad account se il docente non è registrato
- ✅ turni: stesso nome due volte rifiutato (maiuscole e spazi ignorati)
- ✅ turni: un docente già di turno non può essere riassegnato
- ✅ turni: nome troppo corto rifiutato
- ✅ turni: al massimo 3 docenti di turno per giornata
- ✅ turni: se il nome corrisponde a un docente registrato, il turno è collegato al suo account
- ✅ turni: un docente può lasciare il proprio turno
- ✅ turni: un docente non può togliere il turno di un altro
- ✅ turni: i docenti vedono tutti i turni
- ✅ turni: l'amministratore può togliere qualsiasi turno
- ✅ turni: gli studenti non vedono i turni
- ✅ turni: gli studenti non possono prendere turni
- ✅ turni: i visitatori anonimi non possono fare nulla
- ✅ turni: ogni operazione è nel registro
- ✅ turni: niente turni nelle giornate passate

## Autenticazione e registrazione


**1 · Accesso scolastico**

- ✅ il pulsante porta a Google con dominio suggerito e scelta dell'account
- ✅ dopo Google lo studente nuovo arriva alla registrazione
- ✅ cookie di sessione httpOnly e SameSite=Lax
- ✅ la sessione non è leggibile da JavaScript nella pagina

**3 · Registrazione**

- ✅ email recuperata da Google e non modificabile
- ✅ nome e cognome precompilati da Google
- ✅ senza classe la registrazione viene rifiutata
- ✅ dati salvati in Supabase (nome, cognome, classe 4B)
- ✅ l'email manipolata nella pagina non viene salvata

**3 · Area personale**

- ✅ benvenuto con nome e cognome
- ✅ sezioni prenotazioni, liste d'attesa e comunicazioni

**3 · Registrazione**

- ✅ chi è già registrato non rivede il modulo

**8 · Dati personali**

- ✅ lo studente legge solo il proprio profilo
- ✅ lo studente non vede i docenti
- ✅ lo studente non vede il registro operazioni
- ✅ lo studente non legge i tentativi di accesso
- ✅ lo studente non può modificare il proprio profilo direttamente
- ✅ lo studente non può ripetere la registrazione via API
- ✅ senza accesso le API non restituiscono dati
- ✅ /api/me restituisce solo i dati di chi chiama

**7 · Accessi non autorizzati**

- ✅ studente su /docenti → rimandato alla propria area
- ✅ studente su /docenti/iscritti → rimandato alla propria area
- ✅ studente su /docenti/password → rimandato alla propria area

**5 · Logout**

- ✅ dopo l'uscita i cookie di sessione sono cancellati
- ✅ dopo l'uscita l'area personale non è accessibile
- ✅ i vecchi cookie copiati non riaprono la sessione

**4 · Accesso successivo**

- ✅ lo studente registrato entra direttamente nell'area personale
- ✅ nessuna nuova registrazione richiesta
- ✅ nessun profilo duplicato

**2 · Rifiuto account**

- ✅ Gmail personale: rifiutato con messaggio
- ✅ Gmail personale: nessun account creato
- ✅ Gmail personale: nessuna sessione aperta
- ✅ Gmail con dominio scolastico falsificato nel claim hd: rifiutato con messaggio
- ✅ Gmail con dominio scolastico falsificato nel claim hd: nessun account creato
- ✅ Gmail con dominio scolastico falsificato nel claim hd: nessuna sessione aperta
- ✅ account Google di un altro dominio: rifiutato con messaggio
- ✅ account Google di un altro dominio: nessun account creato
- ✅ account Google di un altro dominio: nessuna sessione aperta
- ✅ account del dominio docenti non registrato: rifiutato con messaggio
- ✅ account del dominio docenti non registrato: nessun account creato
- ✅ account del dominio docenti non registrato: nessuna sessione aperta
- ✅ account scolastico con email non verificata: rifiutato con messaggio
- ✅ account scolastico con email non verificata: nessun account creato
- ✅ account scolastico con email non verificata: nessuna sessione aperta

**6 · Docenti**

- ✅ password errata: messaggio generico
- ✅ email inesistente: stesso messaggio (nessuna informazione sugli account)
- ✅ password iniziale: accesso e cambio password obbligatorio
- ✅ finché non cambia password la dashboard resta bloccata
- ✅ nuova password troppo corta rifiutata
- ✅ non si può riusare la password iniziale
- ✅ password attuale sbagliata rifiutata
- ✅ cambio password riuscito
- ✅ dashboard docenti accessibile dopo il cambio

**7 · Accessi non autorizzati**

- ✅ docente su /studente → rimandato alla propria area
- ✅ docente su /registrazione → rimandato alla propria area

**8 · Dati personali**

- ✅ il docente non può azzerare da solo l'obbligo di cambio password

**6 · Docenti**

- ✅ logout docente
- ✅ la vecchia password non funziona più
- ✅ la nuova password funziona e porta alla dashboard
- ✅ dopo 5 errori l'accesso è bloccato anche con la password giusta
- ✅ un docente che prova ad accedere con Google viene respinto
- ✅ …e non resta collegato

**7 · Accessi non autorizzati**

- ✅ senza accesso /studente → /accesso
- ✅ senza accesso /studente/prenotazioni → /accesso
- ✅ senza accesso /registrazione → /accesso
- ✅ senza accesso /docenti → /accesso/docenti
- ✅ senza accesso /docenti/statistiche → /accesso/docenti
- ✅ senza accesso /docenti/password → /accesso/docenti
- ✅ /api/me senza accesso → 401
- ✅ un token con firma falsa viene rifiutato

## Calendario e prenotazioni


**Calendario**

- ✅ 145 giornate da lunedì 16/11/2026 a venerdì 4/6/2027, senza weekend
- ✅ festività nazionali escluse fin dall'inizio (6 giornate feriali)
- ✅ capienza 50 per ogni giornata

**Informazioni giornaliere**

- ✅ data e giorno della settimana
- ✅ prenotazioni, posti disponibili e stato DISPONIBILE

**Prenotazione normale**

- ✅ riepilogo con i dati del profilo, senza richiederli
- ✅ conferma a schermo
- ✅ prenotazione salvata nel database

**Aggiornamento immediato**

- ✅ dopo la prenotazione la scheda mostra 1/50 e 49 posti senza ricaricare
- ✅ la cella del calendario mostra 49 posti liberi

**Prenotazioni duplicate**

- ✅ una seconda prenotazione della stessa giornata è rifiutata
- ✅ 10 richieste simultanee dello stesso studente → 1 sola prenotazione
- ✅ nel calendario il pulsante Prenota non compare più

**Informazioni giornaliere**

- ✅ con 5 posti: stato QUASI COMPLETA ed evidenza

**Ultimo posto**

- ✅ con 49 prenotazioni resta 1 posto
- ✅ l'ultimo posto si prenota
- ✅ la giornata diventa COMPLETA con 50/50

**Cinquantunesima prenotazione**

- ✅ stato COMPLETA e messaggio previsto
- ✅ nessun pulsante per prenotare
- ✅ anche chiamando direttamente l'API la 51ª è rifiutata con lo stesso messaggio

**Prenotazioni contemporanee**

- ✅ 20 transazioni simultanee per gli ultimi 3 posti → esattamente 3 riuscite
- ✅ le altre 17 ricevono il messaggio di giornata completa
- ✅ 70 richieste parallele alle API Supabase per 50 posti → esattamente 50
- ✅ due studenti nello stesso istante per l'ultimo posto → uno solo lo ottiene
- ✅ in nessuna giornata più di 50 prenotazioni attive

**Area personale**

- ✅ prenotazioni future con data della prenotazione e stato

**Cancellazione**

- ✅ conferma a schermo dell'annullamento
- ✅ prenotazione annullata nel database e posto liberato
- ✅ l'area personale si aggiorna subito
- ✅ nel calendario la giornata torna a 50 posti disponibili
- ✅ il posto liberato su una giornata completa è subito prenotabile da altri

**Scadenza 24 ore**

- ✅ prenotazione di una giornata vicina (prima dell'apertura) consentita
- ✅ dopo la scadenza il pulsante Annulla è disabilitato
- ✅ il server rifiuta l'annullamento anche chiamando direttamente l'API
- ✅ la prenotazione resta confermata

**Orari**

- ✅ scadenza in ora legale: 11 aprile 2027 alle 14:15 di Roma (12:15 UTC)
- ✅ l'area personale mostra la scadenza in ora italiana

**Aggiornamento immediato**

- ✅ il calendario di un altro studente si aggiorna senza ricaricare la pagina

**Orari**

- ✅ il docente cambia l'orario di apertura
- ✅ le giornate future usano il nuovo orario
- ✅ la scadenza segue il nuovo orario (30/11 alle 15:00 di Roma)
- ✅ lo studente vede il nuovo orario nel calendario
- ✅ uno studente non può cambiare l'orario

## Lista d'attesa automatica


**1 · Primo in lista**

- ✅ giornata COMPLETA: compare «ISCRIVITI ALLA LISTA D'ATTESA»
- ✅ iscrizione con conferma a schermo: posizione 1
- ✅ la scheda mostra «Sei 1° in lista d'attesa»
- ✅ data e ora di iscrizione registrate
- ✅ iscrizione duplicata impedita
- ✅ secondo studente (smartphone): posizione 2
- ✅ ordine cronologico: terzo e quarto iscritto in posizione 3 e 4

**5 · Area personale**

- ✅ «Le mie liste d'attesa» mostra posizione e totale

**2 · Posto liberato**

- ✅ annullamento di una prenotazione
- ✅ proposta creata subito per il primo in lista
- ✅ tempo per confermare: 2 ore
- ✅ il posto resta trattenuto (49 prenotati + 1 proposto)
- ✅ nessun altro può prenotare il posto proposto

**8 · Automazione**

- ✅ /api/cron/notifications senza segreto → 401
- ✅ il cron lato server invia le email in coda

**3 · Invio proposta**

- ✅ email al primo in lista con link personale
- ✅ l'email indica la scadenza della conferma
- ✅ il token nell'email non è salvato in chiaro nel database

**Sicurezza link**

- ✅ un token inventato non è valido
- ✅ aprire il link non conferma da solo (serve il pulsante)

**4 · Conferma**

- ✅ conferma a schermo dal link
- ✅ prenotazione registrata e studente tolto dalla lista
- ✅ 50 prenotazioni, nessun posto trattenuto
- ✅ email di conferma inviata

**Sicurezza link**

- ✅ il link è utilizzabile una sola volta
- ✅ anche dal server il token usato è rifiutato
- ✅ gli studenti non possono chiamare la conferma via token

**5 · Mancata conferma**

- ✅ proposta al secondo in lista

**5 · Area personale**

- ✅ la proposta compare nell'area personale con «Conferma il posto»

**5 · Mancata conferma**

- ✅ dopo 2 ore il cron fa scadere la proposta
- ✅ email di proposta scaduta

**Sicurezza link**

- ✅ un link scaduto non permette di confermare

**6 · Successivo**

- ✅ proposta automatica al successivo con email

**5 · Area personale**

- ✅ lo storico mostra la proposta «Scaduta»

**6 · Successivo**

- ✅ rinuncia dal link
- ✅ dopo la rinuncia il posto passa subito al successivo

**7 · Cancellazione**

- ✅ uscita dalla lista dall'area personale
- ✅ iscrizione chiusa nel database
- ✅ chi era dietro sale di posizione (da 2° a 1°)

**Dashboard docenti**

- ✅ numero di studenti in attesa, proposte aperte e scadute
- ✅ elenco in ordine cronologico con la proposta aperta
- ✅ proposta scaduta di Marco Neri elencata
- ✅ tempo di conferma modificato a 1 ora
- ✅ lista sospesa: nuove iscrizioni bloccate
- ✅ lista riattivata
- ✅ rimozione di uno studente dalla lista
- ✅ uno studente non può cambiare le impostazioni
- ✅ uno studente non può aprire la dashboard docenti

**8 · Chiusura**

- ✅ il docente chiude la giornata
- ✅ la proposta aperta viene annullata
- ✅ avviso email agli studenti prenotati
- ✅ avviso email agli studenti in lista d'attesa
- ✅ prenotazioni bloccate
- ✅ lista d'attesa sospesa (iscrizioni e proposte)

**9 · Regola 24 ore**

- ✅ prima della soglia la proposta parte
- ✅ dopo la soglia non ci si può più iscrivere
- ✅ una proposta inviata prima della soglia si può confermare anche dopo
- ✅ dopo la soglia lo studente non può più annullare da solo
- ✅ dopo la soglia un posto liberato non viene proposto
- ✅ il posto torna prenotabile da tutti con le regole normali
- ✅ proposta inviata prima della soglia
- ✅ se scade dopo la soglia non si contatta il successivo
- ✅ il posto resta disponibile secondo le regole normali

**10 · Conferme contemporanee**

- ✅ 3 annullamenti simultanei → 3 proposte ai primi 3 in ordine
- ✅ 9 conferme simultanee (3 link × 3 clic) → 3 posti assegnati, uno per link
- ✅ 15 prenotazioni concorrenti durante le conferme: tutte respinte
- ✅ mai più di 50 prenotazioni attive
- ✅ conferma dell'ultimo posto contro 10 prenotazioni simultanee: vince la proposta
- ✅ in nessuna giornata più di 50 prenotazioni

**8 · Automazione**

- ✅ senza browser aperti la manutenzione del database fa scadere e riassegna
- ✅ dopo l'invio nessun token in chiaro resta nella coda

## Dashboard docenti e comunicazioni


**Preparazione**

- ✅ dati di prova nel database (12 + 50 + 3 in attesa + 4)

**1 · Dashboard**

- ✅ totale iscritti letto dal database
- ✅ studenti in lista d'attesa (3)
- ✅ giornate complete (1)
- ✅ pulsante «INVIA COMUNICAZIONE AGLI ISCRITTI»
- ✅ prossime giornate con prenotati e lista d'attesa
- ✅ grafico dell'occupazione

**2 · Calendario**

- ✅ iscritti (12) e posti disponibili (38) della giornata
- ✅ orario della giornata modificato dall'interfaccia
- ✅ nuovo orario 14:30–16:00 salvato nel database

**7 · Registro**

- ✅ cambio di orario registrato

**3 · Chiusura**

- ✅ conferma prima di chiudere una giornata con prenotazioni
- ✅ numero di studenti coinvolti (53)
- ✅ messaggio personalizzabile già precompilato con il motivo
- ✅ giornata chiusa con 53 studenti avvisati
- ✅ chiusura e motivo salvati nel database
- ✅ 53 email personalizzate inviate realmente (50 prenotati + 3 in lista)
- ✅ anche gli studenti in lista d'attesa ricevono il messaggio
- ✅ nessun avviso automatico in più (niente doppie email)

**7 · Registro**

- ✅ chiusura registrata con motivo, coinvolti e comunicazione

**4 · Comunicazioni**

- ✅ la comunicazione di chiusura è salvata con i suoi destinatari

**3 · Chiusura**

- ✅ giornata riaperta dall'interfaccia
- ✅ riapertura salvata: le prenotazioni tornano valide

**7 · Registro**

- ✅ riapertura registrata

**3 · Chiusura**

- ✅ chiusura senza email: scelta rispettata
- ✅ nessuna email inviata ai 4 prenotati

**5 · Iscritti**

- ✅ elenco della giornata con 12 studenti
- ✅ ordine alfabetico per cognome (primo: BIANCHI Giulia)
- ✅ colonne nome, cognome, classe, email, data e ora
- ✅ ricerca per cognome
- ✅ ricerca per nome
- ✅ filtro per classe (4B: 4 studenti)
- ✅ ordinamento per nome (primo: Andrea)

**5 · Esportazione**

- ✅ CSV scaricato con nome della giornata
- ✅ CSV per Excel italiano (BOM, separatore ;)
- ✅ CSV con tutti i 12 iscritti in ordine alfabetico
- ✅ file Excel valido con intestazione e 12 righe
- ✅ esportazione negata senza accesso docente

**5 · Annullamento**

- ✅ il motivo è obbligatorio
- ✅ annullamento confermato a schermo
- ✅ prenotazione annullata nel database con motivo e docente
- ✅ email allo studente con il motivo

**7 · Registro**

- ✅ annullamento manuale registrato

**5 · Annullamento**

- ✅ l'elenco si aggiorna (11 prenotati)

**4 · Comunicazioni**

- ✅ destinatari della giornata: 11 prenotati
- ✅ modello «Modifica orario» applicato
- ✅ anteprima dell'email aggiornata
- ✅ conferma con il numero esatto di destinatari (dal database)
- ✅ invio avviato
- ✅ 10 email consegnate al servizio di invio
- ✅ l'indirizzo rifiutato dal servizio non riceve l'email
- ✅ lo studente annullato non riceve la comunicazione
- ✅ esito registrato per ogni destinatario: 10 inviate, 1 non recapitata
- ✅ errore del servizio email salvato
- ✅ id del messaggio del servizio email salvato per le consegnate
- ✅ storico: 10 inviate e 1 non recapitata
- ✅ storico: indirizzo e motivo dell'errore
- ✅ nuovo invio delle email non recapitate
- ✅ il nuovo invio viene davvero tentato

**7 · Registro**

- ✅ comunicazione e nuovo invio registrati

**4 · Comunicazioni**

- ✅ destinatari solo lista d'attesa: 3
- ✅ comunicazione inviata solo agli studenti in lista d'attesa

**8 · Sicurezza**

- ✅ uno studente non può inviare comunicazioni
- ✅ uno studente non può chiudere giornate
- ✅ uno studente non può annullare prenotazioni altrui
- ✅ oggetto vuoto rifiutato anche chiamando direttamente il database
- ✅ annullamento senza motivo rifiutato dal database

**6 · Statistiche**

- ✅ prenotazioni totali uguali al database
- ✅ media giornaliera, occupazione e lista d'attesa
- ✅ giornate più frequentate (lunedì 30 novembre in testa)
- ✅ classi più rappresentate (5B in testa)

**7 · Registro**

- ✅ tutte le operazioni dei docenti elencate
- ✅ descrizioni leggibili con autore
- ✅ filtro per tipo di operazione
- ✅ ricerca nel registro

**10 · Turni**

- ✅ la giornata mostra «Nessun docente di turno»
- ✅ il docente prende il turno dal calendario
- ✅ turno salvato nel database e collegato all'account
- ✅ l'amministratore assegna il turno scrivendo nome e cognome
- ✅ nome salvato pulito, senza account collegato
- ✅ lo stesso docente non può essere assegnato due volte
- ✅ la dashboard mostra chi è di turno
- ✅ la dashboard segnala le giornate senza docente di turno
- ✅ l'elenco iscritti indica i docenti di turno
- ✅ anche il file Excel riporta i docenti di turno
- ✅ pagina Turni con i miei turni
- ✅ filtro «solo giornate scoperte» esclude quelle coperte
- ✅ il docente lascia il proprio turno
- ✅ un docente non amministratore non ha il campo per assegnare altri
- ✅ e non può togliere il turno di un collega
- ✅ un docente non amministratore prende il proprio turno
- ✅ anche chiamando direttamente il database un non amministratore non assegna turni
- ✅ turni presi, assegnati e lasciati finiscono nel registro

**7 · Registro**

- ✅ cambio dell'orario generale registrato

**9 · Dati reali**

- ✅ le pagine docenti non mostrano dati dimostrativi

## Sicurezza e privacy


**1 · Dominio Google**

- ✅ account Gmail personale: rifiutato, nessun account, nessuna sessione
- ✅ dominio dei docenti: rifiutato, nessun account, nessuna sessione
- ✅ dominio simile ma falso: rifiutato, nessun account, nessuna sessione
- ✅ email scolastica non verificata: rifiutato, nessun account, nessuna sessione
- ✅ account @stud.liceovoltacomo.edu.it accettato

**2 · Sessioni**

- ✅ cookie di sessione httpOnly e SameSite=Lax
- ✅ nessun token leggibile da JavaScript (cookie, localStorage, sessionStorage)

**8 · Privacy**

- ✅ la foto del profilo Google non viene conservata (utente e identità)

**2 · Sessioni**

- ✅ dopo l'uscita i vecchi cookie copiati non riaprono la sessione
- ✅ token con firma alterata rifiutato dal database
- ✅ token scaduto rifiutato dal database

**3 · Intestazioni**

- ✅ Content-Security-Policy restrittiva (default-src 'self', frame-ancestors 'none', object-src 'none')
- ✅ HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy
- ✅ nessuna intestazione X-Powered-By
- ✅ nessuna violazione CSP nelle pagine pubbliche

**4 · Permessi**

- ✅ uno studente non può usare nessuna delle 9 funzioni dei docenti
- ✅ le 8 funzioni interne (email, pulizia, cancellazione) sono negate a studenti, docenti e anonimi
- ✅ B esiste ancora dopo i tentativi di cancellazione
- ✅ uno studente non può annullare la prenotazione di un altro
- ✅ uno studente non apre le pagine dei docenti
- ✅ uno studente non scarica l'elenco degli iscritti
- ✅ senza accesso nessun export (iscritti, dati personali)

**5 · API**

- ✅ cron senza segreto → 401
- ✅ cron con segreto sbagliato → 401
- ✅ /api/me senza accesso → 401
- ✅ registrazione email/password dall'esterno rifiutata (solo docenti invitati)
- ✅ un invito docente scaduto non può essere sfruttato da altri

**6 · Password e chiavi**

- ✅ password dei docenti salvate solo come hash bcrypt

**7 · Database**

- ✅ un visitatore anonimo non legge nessuna delle 12 tabelle con dati
- ✅ uno studente legge solo le proprie righe (profilo, prenotazioni, liste, proposte, comunicazioni)
- ✅ filtrare per l'id di un altro studente non restituisce nulla
- ✅ il calendario degli studenti mostra solo numeri, nessun nome o email
- ✅ senza accesso nemmeno la disponibilità è leggibile
- ✅ inserimento diretto di prenotazioni a nome altrui rifiutato
- ✅ modifica diretta di prenotazioni altrui impossibile
- ✅ uno studente non può cambiare la propria email o diventare docente
- ✅ uno studente non può chiudere giornate scrivendo nel database
- ✅ Row Level Security attiva su tutte le tabelle
- ✅ tutte le funzioni privilegiate hanno search_path fisso

**8 · Privacy**

- ✅ il registro tecnico non contiene email degli studenti

**9 · Link lista d'attesa**

- ✅ link personale con 256 bit esadecimali (64 caratteri)
- ✅ nel database solo l'impronta SHA-256, mai il link in chiaro
- ✅ un link inventato non vale
- ✅ aprire il link non conferma da solo (serve il pulsante)
- ✅ il token non è usabile dall'API pubblica senza il server
- ✅ conferma con il pulsante: prenotazione registrata
- ✅ dopo la conferma il link non è più utilizzabile

**6 · Password e chiavi**

- ✅ nessuna chiave o password nei 47 file inviati al browser
- ✅ nessuna password o chiave scritta nel codice sorgente
- ✅ .env.example senza valori segreti
- ✅ .env* esclusi dal versionamento

**8 · Privacy**

- ✅ /privacy rimanda all'informativa ufficiale della scuola
- ✅ informativa ufficiale raggiungibile dalla pagina di accesso
- ✅ lo studente scarica i propri dati in un file
- ✅ il file non contiene dati di altri studenti
- ✅ solo cookie tecnici (sessione), nessun cookie di terze parti

## Grafica su smartphone, tablet e computer


**Registrazione · smartphone**

- ✅ nessuno scorrimento orizzontale e logo visibile

**Registrazione · tablet**

- ✅ nessuno scorrimento orizzontale e logo visibile

**Registrazione · computer**

- ✅ nessuno scorrimento orizzontale e logo visibile

**Homepage · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Accesso studenti · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Accesso docenti · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ logo del Liceo A. Volta

**Area personale · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta

**Calendario studenti · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Le mie prenotazioni · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Le mie liste d'attesa · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Navigazione studente · smartphone**

- ✅ menu visibile e utilizzabile

**Dashboard docenti · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Calendario docenti · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Lista d'attesa (docenti) · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Iscritti · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Comunicazioni · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Statistiche · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Turni di sorveglianza · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Registro · smartphone**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Navigazione docente · smartphone**

- ✅ menu visibile e utilizzabile

**Homepage · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Accesso studenti · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Accesso docenti · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ logo del Liceo A. Volta

**Area personale · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta

**Calendario studenti · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Le mie prenotazioni · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Le mie liste d'attesa · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Navigazione studente · tablet**

- ✅ menu visibile e utilizzabile

**Dashboard docenti · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Calendario docenti · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Lista d'attesa (docenti) · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Iscritti · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Comunicazioni · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Statistiche · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Turni di sorveglianza · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Registro · tablet**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Navigazione docente · tablet**

- ✅ menu visibile e utilizzabile

**Homepage · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Accesso studenti · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Accesso docenti · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta
- ✅ logo del Liceo A. Volta

**Area personale · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina
- ✅ fotografia originale della biblioteca del Volta

**Calendario studenti · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Le mie prenotazioni · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Le mie liste d'attesa · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Navigazione studente · computer**

- ✅ menu visibile e utilizzabile

**Dashboard docenti · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Calendario docenti · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Lista d'attesa (docenti) · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Iscritti · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Comunicazioni · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Statistiche · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Turni di sorveglianza · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Registro · computer**

- ✅ pagina aperta con il ruolo giusto
- ✅ titolo principale presente
- ✅ nessuno scorrimento orizzontale
- ✅ nessun errore nella console e nessuna risorsa mancante
- ✅ tutte le immagini caricate
- ✅ riconoscimento «App realizzata dal prof. Luca Romanò» in fondo alla pagina

**Navigazione docente · computer**

- ✅ menu visibile e utilizzabile
