/**
 * BIBLIOVOLTA · Provider di identità di prova per i test automatici
 *
 * SOLO PER I TEST. Un server HTTPS locale che risponde come Google OAuth
 * (OpenID Connect: discovery, autorizzazione, token firmati RS256, JWKS,
 * userinfo) su accounts.google.com, raggiunto tramite /etc/hosts e una CA
 * di prova accettata solo dal processo di Supabase Auth avviato nei test.
 *
 * Serve a far girare per intero il flusso reale di Supabase Auth (PKCE,
 * scambio del codice, verifica della firma dell'id_token, creazione
 * dell'utente con il trigger del database) con account scelti dal test:
 * scolastico valido, Gmail personale, altro dominio, email non verificata.
 * Non sostituisce la prova finale con Google vero, descritta nel README.
 */
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, sign as rsaSign } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { join } from "node:path";

const HOSTS = ["accounts.google.com", "oauth2.googleapis.com", "www.googleapis.com", "openidconnect.googleapis.com"];
const ISSUER = "https://accounts.google.com";
const HOSTS_MARK = "# bibliovolta-test-google";

function makeCertificates(dir) {
  mkdirSync(dir, { recursive: true });
  const f = (n) => join(dir, n);
  if (!existsSync(f("leaf.crt"))) {
    const o = (args) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
    o(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt", "-days", "3", "-subj", "/CN=BIBLIOVOLTA Test CA"]);
    o(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr", "-subj", "/CN=accounts.google.com"]);
    writeFileSync(f("ext.cnf"), `subjectAltName=${HOSTS.map((h) => `DNS:${h}`).join(",")}\n`);
    o(["x509", "-req", "-in", "leaf.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "leaf.crt", "-days", "3", "-extfile", "ext.cnf"]);
  }
  const bundle = f("bundle.crt");
  writeFileSync(bundle, readFileSync("/etc/ssl/certs/ca-certificates.crt", "utf8") + "\n" + readFileSync(f("ca.crt"), "utf8"));
  return { key: readFileSync(f("leaf.key")), cert: readFileSync(f("leaf.crt")), bundle };
}

function addHosts() {
  const current = readFileSync("/etc/hosts", "utf8");
  if (current.includes(HOSTS_MARK)) return;
  appendFileSync("/etc/hosts", `\n127.0.0.1 ${HOSTS.join(" ")} ${HOSTS_MARK}\n`);
}
function removeHosts() {
  const current = readFileSync("/etc/hosts", "utf8");
  writeFileSync("/etc/hosts", current.split("\n").filter((l) => !l.includes(HOSTS_MARK)).join("\n").replace(/\n+$/, "\n"));
}

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

export async function startMockGoogle({ dir, clientId, clientSecret }) {
  const tls = makeCertificates(dir);
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = randomBytes(8).toString("hex");
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };

  let nextAccount = null;
  const codes = new Map();
  const tokens = new Map();
  const authorizeRequests = [];

  function idToken(account, nonce) {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: ISSUER,
      aud: clientId,
      azp: clientId,
      sub: account.sub,
      email: account.email,
      email_verified: account.email_verified,
      name: account.name,
      given_name: account.given_name,
      family_name: account.family_name,
      picture: "https://example.invalid/avatar.png",
      iat: now,
      exp: now + 3600,
      ...(account.hd ? { hd: account.hd } : {}),
      ...(nonce ? { nonce } : {}),
    };
    const head = b64({ alg: "RS256", typ: "JWT", kid });
    const body = b64(claims);
    const sig = rsaSign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url");
    return `${head}.${body}.${sig}`;
  }

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const server = https.createServer({ key: tls.key, cert: tls.cert }, async (req, res) => {
    const url = new URL(req.url, `https://${req.headers.host}`);
    let raw = "";
    for await (const chunk of req) raw += chunk;

    if (url.pathname === "/.well-known/openid-configuration") {
      return send(res, 200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/o/oauth2/v2/auth`,
        token_endpoint: "https://oauth2.googleapis.com/token",
        userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: ["openid", "email", "profile"],
      });
    }
    if (url.pathname === "/oauth2/v3/certs") return send(res, 200, { keys: [jwk] });

    if (url.pathname === "/o/oauth2/v2/auth") {
      const params = Object.fromEntries(url.searchParams);
      authorizeRequests.push(params);
      const redirect = new URL(params.redirect_uri);
      redirect.searchParams.set("state", params.state ?? "");
      if (params.client_id !== clientId || !nextAccount) {
        redirect.searchParams.set("error", "access_denied");
      } else if (nextAccount.cancel) {
        redirect.searchParams.set("error", "access_denied");
      } else {
        const code = randomBytes(16).toString("hex");
        codes.set(code, { account: nextAccount, redirectUri: params.redirect_uri, nonce: params.nonce });
        redirect.searchParams.set("code", code);
      }
      res.writeHead(302, { location: redirect.toString() });
      return res.end();
    }

    if (url.pathname === "/token" && req.method === "POST") {
      const form = new URLSearchParams(raw);
      let id = form.get("client_id");
      let secret = form.get("client_secret");
      const basic = req.headers.authorization?.match(/^Basic (.+)$/)?.[1];
      if (basic) [id, secret] = Buffer.from(basic, "base64").toString().split(":").map(decodeURIComponent);
      const entry = codes.get(form.get("code") ?? "");
      if (!entry || id !== clientId || secret !== clientSecret || entry.redirectUri !== form.get("redirect_uri")) {
        return send(res, 400, { error: "invalid_grant" });
      }
      codes.delete(form.get("code"));
      const access = randomBytes(16).toString("hex");
      tokens.set(access, entry.account);
      return send(res, 200, { access_token: access, token_type: "Bearer", expires_in: 3599, scope: "openid email profile", id_token: idToken(entry.account, entry.nonce) });
    }

    if (url.pathname === "/v1/userinfo" || url.pathname === "/userinfo/v2/me") {
      const account = tokens.get(req.headers.authorization?.replace(/^Bearer /, "") ?? "");
      if (!account) return send(res, 401, { error: "invalid_token" });
      return send(res, 200, {
        sub: account.sub, id: account.sub, email: account.email, email_verified: account.email_verified,
        verified_email: account.email_verified, name: account.name, given_name: account.given_name,
        family_name: account.family_name, picture: "https://example.invalid/avatar.png", hd: account.hd,
      });
    }
    send(res, 404, { error: "not_found" });
  });

  await new Promise((ok, ko) => server.once("error", ko).listen(443, "127.0.0.1", ok));
  addHosts();
  process.once("exit", removeHosts); // ripristina /etc/hosts anche in caso di errore

  return {
    caBundle: tls.bundle,
    authorizeRequests,
    /** Imposta l'account con cui "accederà" il prossimo login Google. */
    useAccount(account) {
      nextAccount = account && { sub: createHash("sha256").update(account.email ?? "x").digest("hex").slice(0, 21), ...account };
    },
    async stop() {
      removeHosts();
      await new Promise((ok) => server.close(ok));
    },
  };
}
