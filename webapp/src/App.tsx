import { useState } from 'react';
import { useSnapshot } from './controller';
import { HistoryScreen } from './HistoryScreen';
import { HomeScreen } from './HomeScreen';
import { SetupScreen } from './SetupScreen';
import { pushToast } from './toast';
import { Toast } from './ui';

export function App() {
  const snap = useSnapshot();
  const [route, setRoute] = useState<'home' | 'history' | 'settings'>('home');

  if (snap.isLoading) {
    return (
      <div className="app gradient">
        <div className="loader">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  let screen;
  if (!snap.settings.isCompleted) {
    screen = <SetupScreen onboarding />;
  } else if (route === 'history') {
    screen = <HistoryScreen onBack={() => setRoute('home')} />;
  } else if (route === 'settings') {
    screen = (
      <SetupScreen
        onboarding={false}
        onBack={() => setRoute('home')}
        onSaved={() => {
          setRoute('home');
          pushToast('設定を保存しました');
        }}
      />
    );
  } else {
    screen = (
      <HomeScreen
        onHistory={() => setRoute('history')}
        onSettings={() => setRoute('settings')}
      />
    );
  }

  return (
    <>
      {screen}
      <Toast />
    </>
  );
}
