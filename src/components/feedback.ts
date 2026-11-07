"use client";
// Messaggi a comparsa e animazione di conferma condivisi tra le schede.

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
export type Notify = (msg: string, action?: ToastAction) => void;

/** Animazione di conferma "fatto" + vibrazione (dove supportata). */
export function celebrate() {
  window.dispatchEvent(new Event("sg:celebrate"));
  try {
    navigator.vibrate?.([40, 60, 40]);
  } catch {
    /* non supportato */
  }
}
