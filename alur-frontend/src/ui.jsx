import React from "react";
import { STATUS } from "./lib.js";

export function Chip({ status }) {
  const meta = STATUS[status] || { label: status, color: "#55637f" };
  return (
    <span className="chip" style={{ borderColor: meta.color, color: meta.color }}>
      {meta.label}
    </span>
  );
}

export function Alert({ kind = "info", children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>{children}</div>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: 0, color: "inherit", fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 900 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="Tutup">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="card empty">{children}</div>;
}

export function Loading() {
  return <div className="card empty">Memuat data…</div>;
}

export function Page({ title, sub, action, children }) {
  return (
    <>
      <div className="toolbar">
        <div>
          <h2 className="page-title">{title}</h2>
          {sub && <p className="page-sub" style={{ margin: 0 }}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </>
  );
}

// Small hook: runs an async loader, exposes {data, loading, error, reload}.
export function useLoader(fn, deps = []) {
  const [state, setState] = React.useState({ data: null, loading: true, error: "" });

  const reload = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await fn();
      setState({ data, loading: false, error: "" });
    } catch (err) {
      setState({ data: null, loading: false, error: err.message });
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setError: (error) => setState((s) => ({ ...s, error })) };
}
