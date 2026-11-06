/**
 * Informativa sul trattamento dei dati personali (artt. 13–14 GDPR).
 *
 * BOZZA da sottoporre al Dirigente Scolastico e al Responsabile della
 * protezione dei dati (RPD/DPO) prima della pubblicazione. I campi tra
 * parentesi quadre vanno completati dalla scuola; poi impostare
 * `status: "approvata"` e la data di approvazione.
 *
 * Unica fonte del testo: la pagina /privacy e il documento
 * docs/INFORMATIVA_PRIVACY.md (npm run privacy:doc) nascono da qui.
 */

export type PrivacyBlock = { p: string } | { list: string[] } | { table: { head: string[]; rows: string[][] } };
export type PrivacySection = { id: string; title: string; blocks: PrivacyBlock[] };

export const INFORMATIVA = {
  status: "bozza" as "bozza" | "approvata",
  version: "1.0 – bozza del 6 novembre 2026",
  approvedOn: null as string | null,
  title: "Informativa sul trattamento dei dati personali",
  subtitle: "Servizio BIBLIOVOLTA – prenotazione dell'aula studio (artt. 13 e 14 del Regolamento UE 2016/679)",
  sections: [
    {
      id: "titolare",
      title: "1. Titolare del trattamento e Responsabile della protezione dei dati",
      blocks: [
        { p: "Titolare del trattamento è il Liceo A. Volta di Como, in persona del Dirigente Scolastico pro tempore, con sede in [indirizzo completo], email [indirizzo istituzionale], PEC [indirizzo PEC]." },
        { p: "Il Responsabile della protezione dei dati (RPD/DPO) è [nome o società], contattabile all'indirizzo [email del RPD]." },
      ],
    },
    {
      id: "finalita",
      title: "2. Finalità e base giuridica",
      blocks: [
        { p: "I dati sono trattati esclusivamente per:" },
        {
          list: [
            "gestire le prenotazioni dei posti dell'aula studio della biblioteca (50 posti al giorno, dal lunedì al venerdì) e il loro annullamento;",
            "gestire la lista d'attesa delle giornate complete, proporre i posti che si liberano e inviare le relative email;",
            "inviare comunicazioni di servizio (chiusure, cambi di orario, annullamenti) agli studenti interessati;",
            "consentire ai docenti incaricati di organizzare il servizio (elenco degli iscritti, statistiche aggregate, registro delle operazioni);",
            "garantire la sicurezza del servizio (accesso riservato, protezione dai tentativi di accesso ripetuti).",
          ],
        },
        { p: "La base giuridica è l'esecuzione di un compito di interesse pubblico connesso alle funzioni istituzionali della scuola (art. 6, par. 1, lett. e) del Regolamento e art. 2-ter del D.Lgs. 196/2003). [Da confermare con il RPD.] Non si effettuano profilazione, decisioni automatizzate né trattamenti per finalità di marketing." },
      ],
    },
    {
      id: "dati",
      title: "3. Dati trattati (minimizzazione)",
      blocks: [
        { p: "Sono raccolti solo i dati strettamente necessari al servizio:" },
        {
          list: [
            "Studenti: indirizzo email istituzionale @stud.liceovoltacomo.edu.it (dall'account Google della scuola), nome, cognome, classe; prenotazioni, iscrizioni alla lista d'attesa, proposte di posto e relative date e orari; esito delle email di servizio ricevute.",
            "Docenti: email istituzionale, nome e cognome; operazioni svolte nel servizio; tentativi di accesso (email, indirizzo IP, data e ora) per la protezione dagli accessi non autorizzati.",
            "Dati tecnici: cookie di sessione strettamente necessari per mantenere l'accesso; nessun cookie di profilazione o di terze parti, nessuno strumento di statistica sui visitatori.",
          ],
        },
        { p: "Non sono trattate categorie particolari di dati (art. 9 del Regolamento). La fotografia del profilo Google non viene conservata. Gli altri studenti non possono vedere i dati personali altrui: nel calendario compaiono solo i numeri dei posti occupati." },
      ],
    },
    {
      id: "modalita",
      title: "4. Modalità del trattamento e sicurezza",
      blocks: [
        {
          list: [
            "Accesso degli studenti solo con l'account Google istituzionale (verifica del dominio lato server); accesso dei docenti con credenziali personali, cambio obbligatorio della password iniziale e blocco dopo tentativi ripetuti.",
            "Regole di sicurezza a livello di database (Row Level Security): ogni studente può leggere solo i propri dati; i dati degli iscritti sono visibili solo ai docenti.",
            "Connessioni cifrate (HTTPS), cookie di sessione non accessibili da script, chiavi di servizio conservate solo sul server.",
            "I link personali della lista d'attesa sono casuali, monouso e con scadenza; nel database ne è salvata solo un'impronta crittografica.",
            "Registro delle operazioni dei docenti; il registro tecnico non contiene nomi né indirizzi email.",
          ],
        },
      ],
    },
    {
      id: "destinatari",
      title: "5. Destinatari e responsabili del trattamento",
      blocks: [
        { p: "I dati sono trattati dal personale scolastico autorizzato (docenti incaricati della gestione dell'aula studio e amministratore del servizio). Per il funzionamento tecnico la scuola si avvale dei seguenti fornitori, nominati responsabili del trattamento ai sensi dell'art. 28 del Regolamento: [da formalizzare con i relativi accordi (DPA)]" },
        {
          table: {
            head: ["Fornitore", "Servizio", "Ubicazione dei dati"],
            rows: [
              ["Supabase Inc.", "Database e autenticazione", "Unione Europea (regione eu-central-1, Francoforte)"],
              ["Vercel Inc.", "Pubblicazione dell'applicazione web", "Elaborazione in UE (regione fra1, Francoforte); rete di distribuzione globale"],
              ["Resend (Plus Five Five Inc.)", "Invio delle email di servizio", "Stati Uniti / UE"],
              ["Google LLC / Google Ireland", "Autenticazione con l'account Google Workspace della scuola", "Secondo il contratto Google Workspace for Education già in essere"],
            ],
          },
        },
        { p: "Per eventuali trasferimenti verso Paesi extra UE (in particolare Stati Uniti) si applicano le garanzie previste dagli artt. 44 e seguenti del Regolamento (decisione di adeguatezza EU-US Data Privacy Framework per i fornitori certificati e/o clausole contrattuali standard). I dati non sono diffusi né comunicati ad altri soggetti." },
      ],
    },
    {
      id: "conservazione",
      title: "6. Tempi di conservazione",
      blocks: [
        { p: "I dati sono cancellati automaticamente ogni notte allo scadere dei seguenti termini:" },
        {
          table: {
            head: ["Dati", "Conservazione"],
            rows: [
              ["Prenotazioni, liste d'attesa, proposte di posto, comunicazioni ricevute", "12 mesi dalla data della giornata"],
              ["Profilo dello studente (email, nome, cognome, classe)", "Fino a 12 mesi senza alcuna prenotazione o iscrizione (es. dopo il diploma), oppure fino alla richiesta di cancellazione"],
              ["Registro delle operazioni dei docenti", "24 mesi"],
              ["Tentativi di accesso dei docenti e coda tecnica delle email", "30 giorni"],
              ["Copie di sicurezza (backup) del database", "Secondo la rotazione del fornitore: [7 giorni] / backup manuali [da definire, max 30 giorni]"],
            ],
          },
        },
      ],
    },
    {
      id: "diritti",
      title: "7. Diritti degli interessati",
      blocks: [
        { p: "Gli interessati (e, per gli studenti minorenni, chi esercita la responsabilità genitoriale) possono esercitare in ogni momento i diritti previsti dagli artt. 15–22 del Regolamento: accesso, rettifica, cancellazione, limitazione, opposizione. Lo studente può scaricare in qualsiasi momento una copia dei propri dati dall'area personale («Scarica i miei dati»)." },
        { p: "Le richieste vanno inviate al Titolare o al RPD ai contatti indicati al punto 1. È inoltre possibile proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it)." },
      ],
    },
    {
      id: "natura",
      title: "8. Natura del conferimento",
      blocks: [
        { p: "L'uso del servizio è facoltativo. I dati indicati sono necessari per prenotare un posto: senza di essi non è possibile utilizzare la prenotazione online, ma resta possibile rivolgersi ai docenti responsabili dell'aula studio." },
      ],
    },
  ] satisfies PrivacySection[],
};
