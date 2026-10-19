import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { appController } from './controller';
import './styles.css';

void appController.load();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void appController.syncPending();
});

window.addEventListener('online', () => {
  void appController.syncPending();
});

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
