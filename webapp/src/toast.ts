let message: string | null = null;
const listeners = new Set<() => void>();
let timer = 0;

export function pushToast(text: string): void {
  message = text;
  listeners.forEach((listener) => listener());
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (message !== text) return;
    message = null;
    listeners.forEach((listener) => listener());
  }, 2400);
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToast(): string | null {
  return message;
}
