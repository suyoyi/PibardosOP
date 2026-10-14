"use client";
import { useState } from "react";
export function DeckExport({ text, name }: { text: string; name: string }) {
  const [message, setMessage] = useState("");
  const download = () => {
    const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/[^\p{L}\p{N}_-]/gu, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Lista descargada.");
  };
  return (
    <section className="panel grid gap-4 p-5">
      <h2 className="font-semibold">Exportar lista</h2>
      <p className="text-xs text-muted">
        El texto conserva códigos y cantidades, sin distinguir ilustraciones
        alternativas. Las versiones guardadas sí conservan cada impresión.
      </p>
      <textarea
        aria-label="Lista exportada"
        className="field font-mono text-sm"
        rows={5}
        readOnly
        value={text}
      />
      <div className="flex flex-wrap gap-3">
        <button
          className="button-secondary"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setMessage("Lista copiada.");
            } catch {
              setMessage("Selecciona el texto y cópialo manualmente.");
            }
          }}
        >
          Copiar lista
        </button>
        <button className="button-secondary" type="button" onClick={download}>
          Descargar texto
        </button>
      </div>
      <p role="status" className="text-sm text-muted">
        {message}
      </p>
    </section>
  );
}
