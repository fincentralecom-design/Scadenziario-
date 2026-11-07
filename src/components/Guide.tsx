"use client";
import { useEffect } from "react";
import { BookOpen, X } from "lucide-react";

/** Guida completa all'uso dell'app, scritta in modo semplice. */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "🧭 Come funziona in due parole",
    body: (
      <>
        <p>Lo Scadenziario contiene tutte le scadenze di affittacamere, Partita IVA, affitti e sicurezza della struttura.</p>
        <p>Ogni mattina alle <b>08:30</b> controlla le scadenze e ti avvisa per <b>Email, WhatsApp e SMS</b>:</p>
        <ul>
          <li><b>3 giorni prima</b>: ⏳ PREAVVISO (-3 giorni)</li>
          <li><b>il giorno stesso</b>: 🚨 SCADE OGGI</li>
        </ul>
        <p>Nel messaggio c&apos;è un link: lo apri, premi <b>HO FATTO</b> e la scadenza è chiusa. Non serve la password.</p>
      </>
    ),
  },
  {
    title: "🚦 Il Cruscotto e il semaforo",
    body: (
      <>
        <ul>
          <li><b className="text-red-700">Rosso</b>: scade oggi oppure è già scaduta.</li>
          <li><b className="text-orange-600">Arancione</b>: scade entro 3 giorni.</li>
          <li><b className="text-yellow-700">Giallo</b>: scade nei prossimi 30 giorni.</li>
          <li><b className="text-green-700">Verde</b>: completate nell&apos;ultimo mese.</li>
        </ul>
        <p>Tocca un riquadro colorato per vedere solo quel gruppo. Puoi anche cercare per nome o codice tributo e filtrare per categoria.</p>
        <p>Ogni scheda mostra: <b>data utile</b>, <b>importo</b>, <b>codice tributo F24</b>, dove pagare o inviare, e le note operative.</p>
      </>
    ),
  },
  {
    title: "✅ Segnare una scadenza come pagata / fatta",
    body: (
      <>
        <ol>
          <li>Premi il pulsante verde <b>SEGNA COME PAGATO / FATTO</b>.</li>
          <li>Controlla la data, scrivi se vuoi l&apos;importo pagato e una nota (es. “pagato con home banking”).</li>
          <li>Puoi allegare la ricevuta F24 (foto o PDF, massimo 2 MB).</li>
          <li>Premi <b>CONFERMA: FATTO</b>.</li>
        </ol>
        <p>Se la scadenza si ripete (ogni mese, trimestre, anno…) l&apos;app <b>crea da sola la prossima</b>.</p>
        <p>Hai sbagliato? Premi <b>Annulla ultimo</b> sulla scheda o <b>Annulla</b> nell&apos;elenco delle completate.</p>
      </>
    ),
  },
  {
    title: "🧮 Il calcolatore rapido",
    body: (
      <>
        <p>Alcune scadenze hanno importo variabile. Scrivi il valore richiesto e l&apos;app calcola subito:</p>
        <ul>
          <li><b>IVA autofatture OTA</b>: 22% delle commissioni di Booking, Airbnb, Expedia del mese.</li>
          <li><b>Ritenute professionisti</b>: 20% dei compensi pagati.</li>
          <li><b>Bollo fatture elettroniche</b>: 2 € per ogni fattura sopra 77,47 €.</li>
          <li><b>Registro affitti</b>: 2% del canone annuo (minimo 67 €).</li>
        </ul>
        <p>Con <b>Usa come importo</b> il risultato viene salvato sulla scadenza e comparirà negli avvisi.</p>
      </>
    ),
  },
  {
    title: "📅 Weekend e festivi",
    body: (
      <>
        <p>Se una scadenza fiscale cade di <b>sabato, domenica o festivo nazionale</b>, si sposta al <b>primo giorno lavorativo successivo</b>. La scheda lo indica (es. “spostata dal 15/11, domenica”).</p>
        <p>Festivi considerati: 1 e 6 gennaio, Pasquetta, 25 aprile, 1 maggio, 2 giugno, 15 agosto, 4 ottobre (San Francesco, dal 2026), 1 novembre, 8, 25 e 26 dicembre.</p>
        <p>Lo spostamento si può togliere dalla modifica della scadenza (es. per manutenzioni o scadenze comunali).</p>
      </>
    ),
  },
  {
    title: "➕ Aggiungere, modificare, disattivare",
    body: (
      <>
        <p>Nella scheda <b>Aggiungi</b> scrivi titolo, categoria, data e ricorrenza (una tantum, mensile, trimestrale, semestrale, annuale). Facoltativi: importo, codice F24, dove pagare, note, regola speciale e calcolatore.</p>
        <p>A destra c&apos;è l&apos;elenco completo: <b>Modifica</b>, <b>Disattiva</b> (non ricevi più avvisi ma la scadenza resta) o <b>Elimina</b> (cancella anche lo storico).</p>
        <p>Da controllare subito: <b>estintori, caldaia e certificato Alloggiati Web</b> hanno date indicative da sostituire con quelle reali. Se sei in regime forfettario puoi disattivare le <b>LIPE</b>.</p>
      </>
    ),
  },
  {
    title: "🏠 Affitti & Bolli (contratti di locazione)",
    body: (
      <>
        <p>Inserisci inquilino, immobile, data di decorrenza, canone annuo e se c&apos;è la <b>cedolare secca</b>. L&apos;app crea da sola:</p>
        <ul>
          <li><b>Registrazione RLI</b> entro 30 giorni (registro 2% min. 67 € cod. 1500 + bollo 16 € ogni 4 facciate cod. 1505). In cedolare secca non si paga nulla.</li>
          <li><b>Annualità successive</b> ogni anno entro 30 giorni dall&apos;anniversario (2%, cod. <b>1501</b>), solo senza cedolare.</li>
          <li><b>Proroga</b> entro 30 giorni dalla fine del periodo (cod. <b>1504</b>).</li>
          <li><b>Termine disdetta</b> 6 mesi prima della fine del periodo.</li>
        </ul>
        <p>Se il contratto è già registrato spunta la casella apposita. Modificando il contratto le scadenze vengono ricalcolate.</p>
      </>
    ),
  },
  {
    title: "🔔 Avvisi: chi li riceve e come provarli",
    body: (
      <>
        <p>Nella scheda <b>Avvisi</b> scrivi nome, email, numero WhatsApp e numero SMS (il +39 si aggiunge da solo), scegli i canali e premi <b>Salva</b>.</p>
        <p>Sotto ogni canale vedi se il servizio di invio è <b className="text-green-700">collegato</b>. Se è giallo, manca la configurazione su Netlify (vedi sotto).</p>
        <p>Per provare: scegli una data in “Simula come se oggi fosse” (es. 3 giorni prima di una scadenza), premi <b>Simula Controllo Giornaliero</b> e poi <b>Invia subito questi messaggi di prova</b>. Arrivano con la scritta [TEST].</p>
        <p>Opzione <b>sollecito giornaliero</b>: se una scadenza passa senza conferma, ricevi un promemoria ogni giorno.</p>
      </>
    ),
  },
  {
    title: "📲 Conferma dal telefono (Magic Link)",
    body: (
      <>
        <p>Ogni avviso contiene un link personale. Aprendolo compare un grande pulsante <b>✅ HO FATTO</b>: premilo e la scadenza viene chiusa e registrata nello storico.</p>
        <p>Il link funziona <b>senza password</b>, vale solo per quella scadenza e smette di funzionare dopo l&apos;uso. Se hai sbagliato, nelle 24 ore successive puoi premere “annulla la conferma”.</p>
      </>
    ),
  },
  {
    title: "🧾 Codici tributo F24 principali",
    body: (
      <table className="w-full text-left text-base">
        <tbody className="[&_td]:border-b [&_td]:border-slate-200 [&_td]:py-1.5 [&_td]:pr-3">
          <tr><td><b>6001–6012</b></td><td>IVA mensile (gennaio–dicembre)</td></tr>
          <tr><td><b>1040</b></td><td>Ritenute su compensi a professionisti</td></tr>
          <tr><td><b>2521–2524</b></td><td>Bollo fatture elettroniche 1°–4° trimestre</td></tr>
          <tr><td><b>4001 / 4033 / 4034</b></td><td>IRPEF saldo / 1° acconto / 2° acconto</td></tr>
          <tr><td><b>1792 / 1790 / 1791</b></td><td>Sostitutiva forfettario saldo / 1° / 2° acconto</td></tr>
          <tr><td><b>3850</b></td><td>Diritto annuale Camera di Commercio</td></tr>
          <tr><td><b>3918</b></td><td>IMU altri fabbricati</td></tr>
          <tr><td><b>1500 / 1501</b></td><td>Registro affitti: prima annualità / successive (F24 Elide)</td></tr>
          <tr><td><b>1504 / 1505</b></td><td>Registro proroghe / Bollo contratti (F24 Elide)</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    title: "⚙️ Configurazione su Netlify (per chi gestisce il sito)",
    body: (
      <>
        <p>In Netlify → <b>Site configuration → Environment variables</b>, poi rifare il deploy (<b>Deploys → Trigger deploy</b>):</p>
        <ul className="break-words">
          <li><code>CRON_SECRET</code>: frase lunga e casuale. <b>Obbligatoria</b> per il controllo delle 08:30.</li>
          <li><code>RESEND_API_KEY</code> + <code>EMAIL_FROM</code>: invio email con Resend. Senza dominio verificato si usa <code>onboarding@resend.dev</code> e le email arrivano solo all&apos;indirizzo dell&apos;account Resend.</li>
          <li><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_SMS_FROM</code>, <code>TWILIO_WHATSAPP_FROM</code>: SMS e WhatsApp.</li>
          <li><code>APP_USERNAME</code> / <code>APP_PASSWORD</code>: cambiano utente e password di accesso.</li>
        </ul>
        <p>Le esecuzioni automatiche si vedono in Netlify → Logs → Functions → <b>check-deadlines</b>.</p>
      </>
    ),
  },
  {
    title: "🔐 Accesso e sicurezza",
    body: (
      <>
        <p>L&apos;app si apre solo con <b>nome utente e password</b>. L&apos;accesso resta attivo 30 giorni sul dispositivo; per uscire premi <b>Esci</b> in alto.</p>
        <p>Per cambiare la password imposta <code>APP_PASSWORD</code> su Netlify e rifai il deploy. Non scrivere mai password o chiavi API in messaggi o email.</p>
      </>
    ),
  },
  {
    title: "❓ Domande frequenti",
    body: (
      <>
        <p><b>Non mi arrivano gli avvisi.</b> Controlla nella scheda Avvisi che i canali siano attivi e collegati, poi fai un invio di prova. Guarda anche nello spam.</p>
        <p><b>Ho pagato in anticipo.</b> Segnala come fatta quando vuoi: gli avvisi non partono più per quella scadenza.</p>
        <p><b>Una data del mio Comune è diversa.</b> Modifica la scadenza: le date dell&apos;imposta di soggiorno dipendono dal regolamento comunale.</p>
        <p><b>Ho segnato per errore.</b> Usa “Annulla ultimo”.</p>
      </>
    ),
  },
  {
    title: "⚠️ Avvertenza",
    body: (
      <p>Scadenze e codici tributo sono aggiornati alla normativa vigente al momento della realizzazione e possono cambiare (proroghe, nuove regole). Verifica sempre con il tuo commercialista.</p>
    ),
  },
];

export default function Guide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-black/50 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="flex h-full w-full max-w-3xl flex-col bg-slate-50 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 bg-blue-800 px-5 py-4 text-white sm:rounded-t-3xl">
          <h2 id="guide-title" className="flex items-center gap-2 text-2xl font-extrabold">
            <BookOpen className="h-7 w-7" aria-hidden /> Guida
          </h2>
          <button onClick={onClose} className="flex items-center gap-1 rounded-xl bg-white/15 px-4 py-2 text-lg font-bold hover:bg-white/25">
            <X className="h-6 w-6" aria-hidden /> Chiudi
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-lg text-slate-700">Tocca un argomento per aprirlo.</p>
          {SECTIONS.map((s, i) => (
            <details key={s.title} open={i === 0} className="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer list-none px-5 py-4 text-xl font-extrabold text-slate-900 [&::-webkit-details-marker]:hidden">
                <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
                {s.title}
              </summary>
              <div className="space-y-3 px-5 pb-5 text-lg leading-relaxed text-slate-800 [&_li]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1">
                {s.body}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
