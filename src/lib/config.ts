/**
 * Costanti della piattaforma.
 * Il database (tabella app_settings / school_days) resta la fonte di verità:
 * questi valori servono all'interfaccia e corrispondono ai default SQL.
 */
export const APP = {
  name: "BIBLIOVOLTA",
  tagline: "Prenotazione dell'aula studio",
  school: "Liceo A. Volta",
  city: "Como",
  /** riconoscimento mostrato in fondo a tutte le pagine */
  credit: "App realizzata dal prof. Luca Romanò",
  /** informativa privacy ufficiale della scuola (anche in next.config.ts) */
  privacyUrl: "https://liceovoltacomo.edu.it/privacy-policy/",
} as const;

export const CALENDAR = {
  seasonStart: "2026-11-16", // lunedì
  seasonEnd: "2027-06-04", //   venerdì, ultimo giorno feriale
  bookableWeekdays: [1, 2, 3, 4, 5] as const, // ISO: lunedì–venerdì
  opensAt: "14:15",
  closesAt: "16:30",
  capacity: 50,
  cancellationHours: 24,
  timezone: "Europe/Rome",
} as const;

export const AUTH = {
  studentEmailDomain: "stud.liceovoltacomo.edu.it",
} as const;

export const ROUTES = {
  home: "/",
  login: "/accesso",
  teacherLogin: "/accesso/docenti",
  authCallback: "/auth/callback",
  student: "/studente",
  registration: "/registrazione",
  teacher: "/docenti",
  teacherPassword: "/docenti/password",
  status: "/stato",
  privacy: "/privacy",
  preview: "/anteprima",
} as const;
