import { useEffect, useId, useSyncExternalStore, type ReactNode } from 'react';
import { getToast, subscribeToast } from './toast';

export function Icon({
  name,
  size = 24,
  filled = false,
}: {
  name: string;
  size?: number;
  filled?: boolean;
}) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function TopBar({
  title,
  onBack,
  actions,
}: {
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack && (
        <button type="button" className="icon-button back" onClick={onBack} aria-label="戻る">
          <Icon name="arrow_back" />
        </button>
      )}
      <h1>{title}</h1>
      {actions && <div className="topbar-actions">{actions}</div>}
    </header>
  );
}

export function Button({
  label,
  icon,
  busy = false,
  variant,
  type = 'button',
  onClick,
}: {
  label: string;
  icon?: string;
  busy?: boolean;
  variant: 'primary' | 'gradient';
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      className={`btn ${variant}`}
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? (
        <span className="spinner white" />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} />}
          {label}
        </>
      )}
    </button>
  );
}

export function Dialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {body && <p>{body}</p>}
        <div className="dialog-actions">
          <button type="button" className="text-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="text-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const text = useSyncExternalStore(subscribeToast, getToast);
  if (!text) return null;
  return (
    <div className="toast" role="status">
      {text}
    </div>
  );
}

export function OfflineNotice() {
  return (
    <div className="offline">
      <Icon name="cloud_off" size={18} />
      <p>送信サーバーに未接続です。記録はこのブラウザに保存され、接続後にまとめて送信されます。</p>
    </div>
  );
}
