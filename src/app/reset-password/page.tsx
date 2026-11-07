"use client";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

/** Pagina aperta dal link ricevuto per email: scelta della nuova password. */
export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setToken(new URLSearchParams(location.search).get("t") || ""), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("La password deve avere almeno 8 caratteri.");
    if (next !== again) return setError("Le due password non coincidono.");
    setBusy(true);
    try {
      const res = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Operazione non riuscita");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-800 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <h1 className="mb-1 flex items-center gap-2 text-3xl font-extrabold">
          <KeyRound className="h-8 w-8 text-blue-800" aria-hidden /> Nuova password
        </h1>
        <p className="mb-5 text-base text-slate-500">Scadenziario Anthony Greco</p>
        {done ? (
          <>
            <p className="rounded-xl bg-green-50 p-4 text-lg font-semibold text-green-900">✅ Password cambiata. Ora puoi entrare con la nuova password.</p>
            <a href="/login" className="btn-green mt-5 w-full py-4 text-xl">Vai all&apos;accesso</a>
          </>
        ) : (
          <>
            <label className="label" htmlFor="rp-1">Nuova password (almeno 8 caratteri)</label>
            <input id="rp-1" type="password" autoComplete="new-password" className="field" value={next} onChange={(e) => setNext(e.target.value)} required />
            <label className="label mt-4" htmlFor="rp-2">Ripeti la nuova password</label>
            <input id="rp-2" type="password" autoComplete="new-password" className="field" value={again} onChange={(e) => setAgain(e.target.value)} required />
            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-lg font-semibold text-red-800" role="alert">{error}</p>}
            <button type="submit" className="btn-green mt-6 w-full py-4 text-xl" disabled={busy || !token}>
              {busy ? "Salvataggio…" : "Salva nuova password"}
            </button>
            {!token && <p className="mt-3 text-base text-red-700">Link incompleto: aprilo direttamente dall&apos;email ricevuta.</p>}
          </>
        )}
      </form>
    </main>
  );
}
