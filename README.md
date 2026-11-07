# Scadenziario Pro – Affittacamere, P.IVA & Locazioni

Web app (Next.js + Tailwind) per gestire scadenze fiscali, turistiche, contrattuali e di sicurezza,
con **avvisi automatici via Email, WhatsApp e SMS** 3 giorni prima e il giorno stesso, e conferma
"HO FATTO" con un tocco direttamente dal messaggio (Magic Link, senza login).

## Funzioni principali

| Scheda | Cosa fa |
|---|---|
| **Cruscotto (Semaforo)** | Riepilogo rosso/arancione/giallo/verde, schede con data utile, importo, codice F24, note, calcolatore rapido (22% IVA OTA, 20% ritenute, 2 €×fatture bollo, 2% registro), bottone **SEGNA COME PAGATO / FATTO** con data, importo, nota e ricevuta allegata. Le ricorrenti si rigenerano da sole; “Annulla ultimo” in caso di errore. |
| **Aggiungi / Modifica** | Nuove scadenze personalizzate (titolo, categoria, data, ricorrenza una tantum/mensile/trimestrale/semestrale/annuale, importo, codice F24, note, regola speciale, calcolatore). Modifica, disattiva o elimina quelle esistenti. |
| **Affitti & Bolli** | Contratti di locazione: genera RLI + bollo (1500/1505), annualità successive 2% min. 67 € (1501), proroga (1504) e termine di disdetta a 6 mesi. Ricalcolo automatico se si modifica il contratto. |
| **Alert & Test Invii** | Destinatario, email, WhatsApp, SMS, canali attivi, sollecito per scadute. **Simula Controllo Giornaliero** con anteprima Email/WhatsApp/SMS (anche “come se oggi fosse…”) e invio di prova immediato. |

**Calendario fiscale italiano**: se una scadenza (con l’opzione attiva) cade di sabato, domenica o festivo
nazionale (inclusi Pasquetta e San Francesco 4 ottobre dal 2026) viene spostata al primo giorno lavorativo.
Le scadenze di fine febbraio seguono l’ultimo giorno del mese (29 negli anni bisestili).

Al primo avvio vengono precaricate tutte le scadenze (mensili, trimestrali, annuali, sicurezza),
ciascuna alla prima data futura. Le date di estintori/caldaia/Alloggiati Web sono indicative: vanno personalizzate.

## Prova immediata: `demo/index.html`

Apri **`demo/index.html`** con un doppio clic (Chrome, Edge, Safari, Firefox; anche da telefono):
è l'app completa in un unico file, senza installare nulla. I dati restano nel browser
(localStorage) e gli avvisi sono solo simulati: puoi vedere le anteprime Email/WhatsApp/SMS
e provare il “Magic Link” di conferma. Il pulsante “Ricomincia da zero” cancella i dati di prova.

Per rigenerarlo dopo una modifica al codice: `npm run build:demo`.

## Avvio in locale (versione completa)

```bash
npm install
cp .env.example .env.local   # facoltativo
npm run dev                  # http://localhost:3000
npm test                     # test della logica (date, ricorrenze, contratti, avvisi)
```

Senza configurazione i dati vengono salvati in `data/db.json`.

## Messa online su Netlify (consigliato, nessun database da configurare)

Il progetto è già pronto per Netlify (`netlify.toml`):
- Next.js gira con l'adattatore ufficiale `@netlify/plugin-nextjs` (API, pagine dinamiche, protezione con password);
- i dati vengono salvati in **Netlify Blobs**, persistenti e gratuiti (Supabase resta opzionale);
- la funzione programmata `netlify/functions/check-deadlines.mts` lancia il controllo ogni mattina alle 08:30 italiane.

> ⚠️ Il caricamento “trascina la cartella” (Netlify Drop) **non funziona** per questa app, perché serve
> la parte server. Usa uno dei due metodi qui sotto.

**Metodo A – da GitHub (aggiornamenti automatici):** Netlify → *Add new site* → *Import an existing project*
→ scegli il repository. Build command e cartella vengono letti da `netlify.toml`.

**Metodo B – da computer con lo zip:**
```bash
unzip scadenziario-pro-netlify.zip && cd scadenziario-pro
npm install
npx netlify-cli login
npx netlify-cli deploy --build --prod   # la prima volta chiede di creare/collegare il sito
```

**Variabili d'ambiente** (Netlify → *Site configuration* → *Environment variables*, ambito “Functions”):
`CRON_SECRET` (obbligatoria), `APP_PASSWORD` (consigliata), e le chiavi dei provider
(`RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_*` o `BREVO_*`). Dopo averle aggiunte rifai il deploy.
Il link pubblico usato nei messaggi è preso in automatico dall'indirizzo del sito (variabile `URL`),
oppure da `APP_URL` / dal campo nelle Impostazioni se usi un dominio personalizzato.

Verifica: nella scheda *Alert & Test Invii* usa “Simula Controllo Giornaliero”; su Netlify → *Logs* →
*Functions* → `check-deadlines` vedi l'esito delle esecuzioni mattutine.

## Messa online (Vercel + Supabase)

1. Crea un progetto **Supabase** ed esegui `supabase/schema.sql` nel SQL Editor.
2. Importa il repository su **Vercel** e imposta le variabili d’ambiente (vedi `.env.example`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `APP_PASSWORD` (consigliata),
   più i provider di invio.
3. `vercel.json` programma `/api/cron/check-deadlines` alle 06:30 e 07:30 UTC: in ora solare e legale
   una delle due cade alle **08:30 italiane**; prima delle 8 l’endpoint non fa nulla e ogni avviso
   parte una sola volta al giorno. Sul piano Hobby Vercel l’orario può variare entro l’ora.

> Su Vercel senza Supabase l’app funziona ma i dati sono temporanei (compare un avviso giallo).

**Altro hosting** (VPS, Docker, NAS): `npm run build && npm start`, poi un cron di sistema:

```cron
30 8 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tuo-dominio.it/api/cron/check-deadlines
```

Parametri utili dell’endpoint: `?force=1` (ignora l’orario), `?dryRun=1` (non invia), `?date=2026-11-13` (simula un giorno).

## Provider di invio

- **Email**: Resend (`RESEND_API_KEY`, `EMAIL_FROM` con dominio verificato) oppure Brevo.
- **SMS**: Twilio (`TWILIO_SMS_FROM` o `TWILIO_MESSAGING_SERVICE_SID`) oppure Brevo (`BREVO_SMS_SENDER`).
- **WhatsApp**: Twilio (`TWILIO_WHATSAPP_FROM`). Per messaggi avviati dall’app oltre le 24 ore WhatsApp
  richiede un **template approvato**: impostare `TWILIO_WHATSAPP_CONTENT_SID` (variabili `{{1}}` oggetto,
  `{{2}}` data, `{{3}}` link). Per i test basta la Sandbox Twilio.

I numeri senza prefisso vengono considerati italiani (+39).

## Regole degli avvisi

- Controllo ogni mattina sulle scadenze attive “da fare”.
- `giorni_rimanenti === 3` → **⏳ PREAVVISO (-3 giorni): [Titolo]**
- `giorni_rimanenti === 0` → **🚨 SCADE OGGI: [Titolo]**
- Facoltativo: **❗ SCADUTA da N giorni** ogni giorno finché non viene confermata.
- I giorni si contano sulla data utile (già spostata per weekend/festivi).

## Magic Link `/conferma/[id]`

Ogni messaggio contiene un link firmato (HMAC) legato alla scadenza **e alla sua data**: aprendolo si vede
un solo bottone gigante **HO FATTO / CONFERMA PAGAMENTO**. La chiusura avviene solo premendo il bottone,
così le anteprime automatiche di WhatsApp o dei programmi email non possono confermare per errore.
Un link vecchio non può chiudere l’occorrenza successiva di una scadenza ricorrente. Per 24 ore è
possibile annullare la conferma dalla stessa pagina.

## Struttura

```
src/lib/dates.ts        calendario, festivi italiani, Pasqua, giorni lavorativi
src/lib/deadlines.ts    semaforo, ricorrenze, completamento/annullamento, codici F24 automatici
src/lib/seed.ts         scadenze precaricate (facile aggiungerne di nuove)
src/lib/contracts.ts    generatore scadenze locazioni (RLI, 1501, 1504, disdetta)
src/lib/alerts.ts       regole -3/0 giorni e testi Email/WhatsApp/SMS
src/lib/notify.ts       invio via Resend / Brevo / Twilio (REST, senza SDK)
src/lib/store/          persistenza: file JSON o Supabase (documenti JSONB, nessuna migrazione per nuovi campi)
src/app/api/...         API REST + cron
src/app/conferma/[id]   pagina Magic Link
src/components/         interfaccia (4 schede)
```

## Note fiscali

Le scadenze e i codici tributo riflettono la normativa vigente al momento dello sviluppo e sono modificabili
dall’interfaccia. Verificare sempre con il proprio commercialista: in particolare il minimo di 67 € sulle
annualità successive (applicato come richiesto; secondo la prassi dell’Agenzia il minimo riguarda la prima
annualità), il numero di copie soggette a bollo e le date del regolamento comunale sull’imposta di soggiorno.
