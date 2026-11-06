-- =====================================================================
-- BIBLIOVOLTA · Seed facoltativo · Festività nazionali 2026/27
-- =====================================================================
-- Chiude le giornate feriali che coincidono con festività nazionali.
-- NB: dalla migrazione 6 queste chiusure sono già applicate in automatico;
-- lo script resta utile per ripristinarle se un docente le avesse riaperte.
-- NON include vacanze natalizie/pasquali né ponti del calendario
-- regionale lombardo o delibere d'istituto: quelle le configurano i
-- docenti dall'area riservata (Fase 5).
-- Eseguire nel SQL Editor di Supabase solo se si desidera.
-- =====================================================================

update public.school_days d
   set is_open = false,
       closure_reason = f.reason
  from (values
    (date '2026-12-08', 'Immacolata Concezione'),
    (date '2026-12-25', 'Natale'),
    (date '2027-01-01', 'Capodanno'),
    (date '2027-01-06', 'Epifania'),
    (date '2027-03-29', 'Lunedì dell''Angelo'),
    (date '2027-06-02', 'Festa della Repubblica')
  ) as f(day, reason)
 where d.day = f.day;
