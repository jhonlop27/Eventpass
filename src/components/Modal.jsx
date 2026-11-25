import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({ abierto, cerrar, titulo, children, bloqueado = false }) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!abierto) return;
    d.showModal();
    return () => {
      if (d.open) d.close();
    };
  }, [abierto]);
  if (!abierto) return null;
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!bloqueado) cerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !bloqueado) {
          const r = ref.current.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            cerrar();
        }
      }}
    >
      <div className="modal-enc">
        <h2 id={id}>{titulo}</h2>
        <button
          className="icono"
          type="button"
          disabled={bloqueado}
          aria-label="Cerrar ventana"
          onClick={cerrar}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
