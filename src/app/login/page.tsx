"use client";
import { useState } from "react";
import { CalendarCheck, Eye, EyeOff, LogIn } from "lucide-react";
import Splash from "@/components/Splash";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Accesso non riuscito");
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-800 px-4 py-10">
      <Splash />
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <CalendarCheck className="h-12 w-12 shrink-0 text-blue-800" aria-hidden />
          <div>
            <h1 className="text-3xl font-extrabold leading-tight text-slate-900">Scadenziario Greco</h1>
            <p className="text-base text-slate-500">By Bruno Greco</p>
          </div>
        </div>
        <label className="label" htmlFor="l-user">Nome utente</label>
        <input id="l-user" className="field" autoComplete="username" autoCapitalize="none" required value={user} onChange={(e) => setUser(e.target.value)} />
        <label className="label mt-4" htmlFor="l-pass">Password</label>
        <div className="relative">
          <input
            id="l-pass"
            type={show ? "text" : "password"}
            className="field !pr-14"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-600" aria-label={show ? "Nascondi password" : "Mostra password"}>
            {show ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
          </button>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-lg font-semibold text-red-800" role="alert">{error}</p>}
        <button type="submit" className="btn-green mt-6 w-full py-4 text-xl" disabled={busy}>
          <LogIn className="h-6 w-6" aria-hidden /> {busy ? "Accesso in corso…" : "ENTRA"}
        </button>
        <p className="mt-4 text-center text-base text-slate-500">L&apos;accesso resta attivo per 30 giorni su questo dispositivo.</p>
      </form>
    </main>
  );
}
