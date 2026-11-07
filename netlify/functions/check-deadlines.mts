// Funzione programmata di Netlify: ogni mattina richiama il controllo delle scadenze.
// Orari in UTC: 06:30 e 07:30 → una delle due corrisponde sempre alle 08:30 italiane
// (ora solare/legale). L'endpoint ignora la chiamata prima delle 8 e non invia doppioni.
export default async () => {
  const base = process.env.APP_URL || process.env.URL;
  const res = await fetch(`${base}/api/cron/check-deadlines`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  console.log(`check-deadlines → ${res.status}: ${(await res.text()).slice(0, 500)}`);
};

export const config = { schedule: "30 6,7 * * *" };
