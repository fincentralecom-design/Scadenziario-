"use client";
// Esportazione dell'elenco scadenze (già filtrato) in Excel e PDF, direttamente nel browser.
import { formatShort } from "@/lib/dates";
import { daysLeft, effectiveDate, f24CodeFor, formatEuro } from "@/lib/deadlines";
import { CATEGORY_LABELS, RECURRENCE_LABELS, type Deadline } from "@/lib/types";

function statusOf(d: Deadline, today: string): string {
  if (!d.active) return "Disattivata";
  if (d.status === "done") return "Completata";
  const n = daysLeft(d, today);
  if (n < 0) return `Scaduta da ${-n} gg`;
  if (n === 0) return "Scade oggi";
  return `Tra ${n} gg`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const stamp = (today: string) => today.replace(/-/g, "");

export async function exportExcel(list: Deadline[], today: string): Promise<void> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  const bold = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#DBEAFE" });
  const header = ["Scadenza", "Titolo", "Categoria", "Ricorrenza", "Importo €", "Codice F24", "Dove", "Stato", "Ultima volta fatto", "Note"].map(bold);
  const rows = list.map((d) => {
    const last = d.history[0];
    return [
      { value: new Date(`${effectiveDate(d)}T12:00:00Z`), type: Date, format: "dd/mm/yyyy" },
      { value: d.title, wrap: true },
      { value: CATEGORY_LABELS[d.category] },
      { value: RECURRENCE_LABELS[d.recurrence] },
      d.amount ? { value: d.amount, type: Number, format: "#,##0.00" } : null,
      { value: f24CodeFor(d) ?? "" },
      { value: d.portal ?? "", wrap: true },
      { value: statusOf(d, today) },
      { value: last ? new Date(last.completedAt).toLocaleDateString("it-IT") : "" },
      { value: [d.description, d.notes].filter(Boolean).join(" – "), wrap: true },
    ];
  });
  const columns = [{ width: 12 }, { width: 48 }, { width: 18 }, { width: 13 }, { width: 12 }, { width: 26 }, { width: 30 }, { width: 16 }, { width: 16 }, { width: 60 }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await writeExcelFile([header, ...rows] as any, { columns, sheet: "Scadenze", stickyRowsCount: 1 }).toBlob();
  save(blob, `scadenziario-greco-${stamp(today)}.xlsx`);
}

export async function exportPdf(list: Deadline[], today: string, filtersLabel: string): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(18);
  doc.setTextColor(29, 78, 216);
  doc.text("Scadenziario Anthony Greco", 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`By Bruno Greco · Elenco scadenze al ${formatShort(today)} · ${list.length} voci`, 14, 21);
  if (filtersLabel) doc.text(`Filtri: ${filtersLabel}`, 14, 26);
  const total = list.reduce((s, d) => s + (d.amount ?? 0), 0);
  autoTable(doc, {
    startY: filtersLabel ? 30 : 26,
    head: [["Scadenza", "Titolo", "Categoria", "Ricorrenza", "Importo", "Codice F24", "Stato"]],
    body: list.map((d) => [
      formatShort(effectiveDate(d)),
      d.title,
      CATEGORY_LABELS[d.category],
      RECURRENCE_LABELS[d.recurrence],
      d.amount ? formatEuro(d.amount) : "",
      f24CodeFor(d) ?? "",
      statusOf(d, today),
    ]),
    foot: total ? [["", "Totale importi indicati", "", "", formatEuro(total), "", ""]] : undefined,
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [29, 78, 216] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 85 }, 4: { halign: "right", cellWidth: 24 }, 5: { cellWidth: 45 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const v = String(data.cell.raw);
        if (v.startsWith("Scad")) data.cell.styles.textColor = [185, 28, 28];
        else if (v === "Completata") data.cell.styles.textColor = [21, 128, 61];
      }
    },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Pagina ${i} di ${pages}`, 283, 205, { align: "right" });
  }
  save(doc.output("blob"), `scadenziario-greco-${stamp(today)}.pdf`);
}
