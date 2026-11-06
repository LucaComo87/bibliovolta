import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { isAllowedStudentEmail } from "@/lib/auth/domain";
import { protectedRedirect, type SessionInfo } from "@/lib/auth/routing";
import { ROUTES } from "@/lib/config";
import { SESSION_COOKIE_OPTIONS } from "./cookies";

const PROTECTED_PREFIXES = [ROUTES.student, ROUTES.teacher, ROUTES.registration];

/**
 * Eseguito dal proxy (ex middleware) a ogni richiesta:
 *  1. rinnova il token di sessione Supabase e aggiorna i cookie;
 *  2. per le aree riservate legge il ruolo dal database e reindirizza
 *     PRIMA del rendering: uno studente non riceve nemmeno l'involucro
 *     delle pagine docenti (e viceversa).
 * Il controllo è ripetuto nei layout (requireRole) e, soprattutto, nel
 * database (RLS): il proxy è il primo dei tre livelli, non l'unico.
 */
export async function updateSession(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!isSupabaseConfigured()) {
    if (isProtected) return redirectTo(request, ROUTES.status);
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() verifica la firma del JWT: non fidarsi di getSession() lato server.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!isProtected) return response;

  let session: SessionInfo = { kind: "anonymous" };
  if (userId) {
    const amr = Array.isArray(claims?.amr) ? (claims!.amr as { method?: string }[]) : [];
    const method = amr[amr.length - 1]?.method;
    const [{ data: teacher }, { data: student }] = await Promise.all([
      supabase.from("teachers").select("must_change_password").eq("id", userId).eq("is_active", true).maybeSingle(),
      supabase.from("students").select("email, registered_at").eq("id", userId).eq("is_active", true).maybeSingle(),
    ]);
    if (teacher && method === "password") session = { kind: "teacher", mustChangePassword: teacher.must_change_password };
    else if (student && method === "oauth" && isAllowedStudentEmail(student.email)) session = { kind: "student", registered: Boolean(student.registered_at) };
    else session = { kind: "invalid" };
  }

  const target = protectedRedirect(request.nextUrl.pathname, session);
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // mantiene i cookie eventualmente rinnovati
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
