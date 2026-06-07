import { cookies } from "next/headers";
import { AppShell } from "../../components/app-shell";
import { resolveLocalSession, webSessionCookieName } from "../../lib/auth-api";
import { loginAction, logoutAction, registerAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(webSessionCookieName)?.value;
  const currentUser = await safeResolveSession(token);
  const feedback = feedbackMessage(params?.registered, params?.loggedIn, params?.loggedOut, params?.error);

  return (
    <AppShell activePath="/login">
      <section className="card hero-card">
        <p className="kicker">Konto &amp; Zugang</p>
        <h1>Anmelden</h1>
        <p>
          E-Mail und Passwort eingeben, um Ihre Session zu starten.
        </p>
        <div className="badge-row">
          <span className={currentUser ? "badge success" : "badge danger"}>{currentUser ? "Session aktiv" : "Nicht eingeloggt"}</span>
        </div>
        {feedback ? <p className={`notice ${feedback.kind}`}>{feedback.message}</p> : null}
      </section>

      <section className="content-grid">
        <form className="card form-card" action={registerAction}>
          <p className="kicker">Registrieren</p>
          <label>
            Name
            <input name="name" placeholder="SEO Ops" />
          </label>
          <label>
            E-Mail
            <input name="email" type="email" required placeholder="owner@example.com" />
          </label>
          <label>
            Passwort
            <input name="password" type="password" required minLength={12} placeholder="mindestens 12 Zeichen" />
          </label>
          <button className="button" type="submit">User anlegen</button>
        </form>

        <div className="card form-card">
          <p className="kicker">Aktuelle Session</p>
          {currentUser ? (
            <div className="auth-panel">
              <strong>{currentUser.name}</strong>
              <span>{currentUser.email}</span>
              <span>Rolle: {currentUser.role} · Status: {currentUser.status}</span>
              <form action={logoutAction}>
                <button className="button secondary" type="submit">Logout</button>
              </form>
            </div>
          ) : (
            <form className="form-card embedded" action={loginAction}>
              <label>
                E-Mail
                <input name="email" type="email" required placeholder="owner@example.com" />
              </label>
              <label>
                Passwort
                <input name="password" type="password" required minLength={12} placeholder="mindestens 12 Zeichen" />
              </label>
              <button className="button" type="submit">Login</button>
            </form>
          )}
        </div>
      </section>
    </AppShell>
  );
}

async function safeResolveSession(token: string | undefined) {
  try {
    return await resolveLocalSession(token);
  } catch {
    return null;
  }
}

function feedbackMessage(registered: string | string[] | undefined, loggedIn: string | string[] | undefined, loggedOut: string | string[] | undefined, error: string | string[] | undefined): { kind: "success" | "danger"; message: string } | null {
  const errorValue = Array.isArray(error) ? error[0] : error;
  if (errorValue) return { kind: "danger", message: errorValue };
  if (registered) return { kind: "success", message: "User wurde angelegt. Du kannst dich jetzt einloggen." };
  if (loggedIn) return { kind: "success", message: "Login erfolgreich. Session-Cookie ist aktiv." };
  if (loggedOut) return { kind: "success", message: "Logout erfolgreich." };
  return null;
}
