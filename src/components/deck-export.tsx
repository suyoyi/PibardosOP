"use client";
import { useState, useRef } from "react";
import { Modal } from "./modal";
export function DeckExport({ text }: { text: string }) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [copying, setCopying] = useState(false),
    area = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <button
        className="button-secondary"
        type="button"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
      >
        Exportar lista
      </button>
      {open && (
        <Modal
          title="Exportar lista"
          onClose={() => setOpen(false)}
          busy={copying}
        >
          <div className="grid gap-4">
            <textarea
              ref={area}
              aria-label="Lista exportada"
              className="field font-mono text-sm"
              rows={12}
              readOnly
              value={text}
            />
            <button
              className="button-primary justify-self-start"
              type="button"
              disabled={copying}
              onClick={async () => {
                setCopying(true);
                try {
                  await navigator.clipboard.writeText(text);
                  setMessage("Lista copiada al portapapeles.");
                } catch {
                  area.current?.focus();
                  area.current?.select();
                  setMessage(
                    "No se pudo acceder al portapapeles. La lista está seleccionada para copiarla manualmente.",
                  );
                } finally {
                  setCopying(false);
                }
              }}
            >
              {copying ? "Copiando…" : "Copiar"}
            </button>
            {message && (
              <p role="status" className="text-sm text-muted">
                {message}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
