import { useEffect, useState } from 'react';
import { CameraFrame } from './CameraFrame';
import { appController, useSnapshot } from './controller';
import { resultLabel, SLOTS, slotsLabel } from './models';
import { cachedPhotoUrl, hydratePhoto } from './photos';
import {
  currentOccurrence,
  nextReportTime,
  occurrenceLabel,
  parseDateKey,
} from './schedule';
import { Dialog, Icon, OfflineNotice, TopBar } from './ui';

export function HomeScreen({
  onHistory,
  onSettings,
}: {
  onHistory: () => void;
  onSettings: () => void;
}) {
  const snap = useSnapshot();
  const now = useNow();
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  const [askPhoto, setAskPhoto] = useState(false);
  const occurrence = currentOccurrence(snap.settings.slots, snap.records, now);
  const submitted = snap.lastSubmitted;

  useEffect(() => {
    return () => {
      if (draft) URL.revokeObjectURL(draft.url);
    };
  }, [draft]);

  async function submit(taken: boolean, photo: Blob | null) {
    try {
      await appController.submit(taken, photo);
      if (draft) URL.revokeObjectURL(draft.url);
      setDraft(null);
      setAskPhoto(false);
    } catch {
      // 失敗時はトースト済み。撮影した写真は残す。
    }
  }

  function choose(taken: boolean) {
    if (taken && !draft) {
      setAskPhoto(true);
      return;
    }
    void submit(taken, draft?.blob ?? null);
  }

  return (
    <div className="app gradient">
      <div className="shell">
        <TopBar
          title="おくすり記録"
          actions={
            <>
              <button type="button" className="icon-button" onClick={onHistory} aria-label="履歴">
                <Icon name="history" />
              </button>
              <button type="button" className="icon-button" onClick={onSettings} aria-label="設定">
                <Icon name="settings" />
              </button>
            </>
          }
        />
        <main className="page">
          <header className="occurrence">
            <span className="brand-pill gradient">
              {snap.settings.patientName
                ? `${snap.settings.patientName} さんの記録`
                : '今回の記録'}
            </span>
            <div className="occurrence-date">
              <span className="date-num">
                {occurrence.date.getMonth() + 1}/{occurrence.date.getDate()}
              </span>
              <span className="slot-badge">
                <Icon name={SLOTS[occurrence.slot].icon} size={20} />
                {SLOTS[occurrence.slot].label}
              </span>
            </div>
            <p className="muted">毎日 {slotsLabel(snap.settings.slots)} の記録</p>
          </header>

          {submitted ? (
            <RecordedCard />
          ) : (
            <>
              <CameraFrame
                photoUrl={draft?.url ?? null}
                enabled={!snap.isSubmitting}
                onCaptured={(blob) => {
                  if (draft) URL.revokeObjectURL(draft.url);
                  setDraft({ blob, url: URL.createObjectURL(blob) });
                }}
                onCleared={() => {
                  if (draft) URL.revokeObjectURL(draft.url);
                  setDraft(null);
                }}
              />
              <div className="choices">
                <button
                  type="button"
                  className="choice blue"
                  disabled={snap.isSubmitting}
                  onClick={() => choose(false)}
                >
                  <Icon name="remove_circle" size={22} />
                  飲んでない
                </button>
                <button
                  type="button"
                  className="choice pink filled"
                  disabled={snap.isSubmitting}
                  onClick={() => choose(true)}
                >
                  <Icon name="check_circle" size={22} />
                  飲んだ
                </button>
              </div>
              <p className="hint">
                <Icon name="schedule" size={15} />
                記録は翌朝 8 時に家族へ届きます
              </p>
            </>
          )}

          {!snap.isCloudEnabled && <OfflineNotice />}
        </main>
      </div>

      {askPhoto && (
        <Dialog
          title="写真なしで記録しますか？"
          body="写真があると、飲んだ様子もあわせて家族に届きます。"
          cancelLabel="写真を撮る"
          confirmLabel="写真なしで記録"
          onCancel={() => setAskPhoto(false)}
          onConfirm={() => void submit(true, null)}
        />
      )}
    </div>
  );
}

function RecordedCard() {
  const snap = useSnapshot();
  const now = useNow();
  const record = snap.lastSubmitted;
  const sendAt = nextReportTime(now);
  const [src, setSrc] = useState<string | null>(() =>
    record ? cachedPhotoUrl(record.photoKey) ?? record.photoUrl : null,
  );

  useEffect(() => {
    if (!record?.photoKey) {
      setSrc(record?.photoUrl ?? null);
      return;
    }
    let cancel = false;
    void hydratePhoto(record.photoKey).then((url) => {
      if (!cancel) setSrc(url ?? record.photoUrl);
    });
    return () => {
      cancel = true;
    };
  }, [record?.photoKey, record?.photoUrl]);

  if (!record) return null;
  const accent = record.taken ? 'pink' : 'blue';

  return (
    <section className={`card roomy center ${record.taken ? 'pink-border' : 'blue-border'}`}>
      <div className={`badge-circle ${accent}`}>
        <Icon name={record.taken ? 'check_circle' : 'info'} size={34} filled={record.taken} />
      </div>
      <h2 className="recorded-title">
        {occurrenceLabel({ date: parseDateKey(record.date), slot: record.slot })} を記録しました
      </h2>
      <span className={`result-pill ${accent}`}>{resultLabel(record.taken)}</span>
      {src && <img className="preview" src={src} alt="" />}
      <div className="status-box">
        <div className="status-line">
          <Icon name="send" size={16} />
          {sendAt.getMonth() + 1}/{sendAt.getDate()} 8:00 に送信予定
        </div>
        <div className="recipients">
          {snap.settings.recipientEmails.length === 0
            ? '送信先が未登録です'
            : snap.settings.recipientEmails.map((email, index) => <div key={index}>{email}</div>)}
        </div>
        <div className="sync-line">
          <Icon name={record.syncedAt ? 'cloud_done' : 'cloud_upload'} size={15} />
          {record.syncedAt ? 'サーバーへ送信済み' : 'このブラウザに保存済み（次回の接続時に送信）'}
        </div>
      </div>
      <div className="recorded-actions">
        <button type="button" className="btn gradient" onClick={() => appController.dismissConfirmation()}>
          <Icon name="arrow_forward" size={20} />
          次の記録へ
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => void appController.undoLastSubmitted()}
        >
          この記録を取り消す
        </button>
      </div>
    </section>
  );
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
