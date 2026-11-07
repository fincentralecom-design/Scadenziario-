"use client";
import { useEffect, useState } from "react";

const KEY = "sg-splash-shown";

/** Schermata di apertura animata: compare una volta per sessione, si chiude da sola o con un tocco. */
export default function Splash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "leave">("hidden");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* archiviazione non disponibile: mostra comunque */
    }
    if (seen) return;
    setPhase("show");
    const t1 = setTimeout(() => setPhase("leave"), 2400);
    const t2 = setTimeout(() => setPhase("hidden"), 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-700 px-6 text-center text-white transition-opacity duration-500 ${phase === "leave" ? "pointer-events-none opacity-0" : "opacity-100"}`}
      onClick={() => {
        setPhase("leave");
        setTimeout(() => setPhase("hidden"), 500);
      }}
      role="presentation"
    >
      <SplashArt />
      <p className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] text-sm text-blue-200/80">Tocca per entrare</p>
    </div>
  );
}

/** Contenuto grafico condiviso (usato anche per generare l'immagine PNG). */
export function SplashArt() {
  return (
    <>
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden />
      <div className="splash-icon relative flex h-36 w-36 items-center justify-center rounded-[2.2rem] bg-white shadow-2xl">
        <svg viewBox="0 0 64 64" className="h-24 w-24" aria-hidden>
          <rect x="10" y="12" width="44" height="42" rx="7" fill="#1d4ed8" />
          <rect x="10" y="12" width="44" height="12" rx="6" fill="#1e3a8a" />
          <rect x="19" y="6" width="5" height="12" rx="2.5" fill="#1e3a8a" />
          <rect x="40" y="6" width="5" height="12" rx="2.5" fill="#1e3a8a" />
          <path className="splash-check" d="M21 38l8 8 15-16" stroke="#4ade80" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="splash-title mt-8 text-[2.6rem] font-black leading-[1.05] tracking-tight drop-shadow sm:text-6xl">
        Scadenziario
        <br />
        <span className="text-yellow-300">Anthony Greco</span>
      </h1>
      <p className="splash-sub mt-5 text-2xl font-semibold italic text-blue-50 sm:text-3xl">....così non ti lamenti più!</p>
      <p className="splash-sub mt-8 text-sm uppercase tracking-[0.25em] text-blue-200">By Bruno Greco</p>
    </>
  );
}
