import { useEffect, useState } from 'react';
import { appController, useSnapshot } from './controller';
import { resultLabel, SLOTS, type DoseRecord } from './models';
import { cachedPhotoUrl, hydratePhoto } from './photos';
import { occurrenceLabel } from './schedule';
import { Dialog, Icon, TopBar } from './ui';

export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const snap = useSnapshot();
  const [pending, setPending] = useState<DoseRecord | null>(null);

  return (
    <div className="app gradient">
      <div className="shell">
        <TopBar title="記録の履歴" onBack={onBack} />
        <main className="page">
          {snap.records.length === 0 ? (
            <p className="empty">まだ記録がありません</p>
          ) : (
            <div className="record-list">
              {snap.records.map((record) => (
                <RecordRow
                  key={`${record.date}#${record.slot}`}
                  record={record}
                  onDelete={() => setPending(record)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
      {pending && (
        <Dialog
          title={`${labelOf(pending)} の記録を削除しますか？`}
          cancelLabel="やめる"
          confirmLabel="削除する"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const record = pending;
            setPending(null);
            void appController.deleteRecord(record);
          }}
        />
      )}
    </div>
  );
}

function RecordRow({ record, onDelete }: { record: DoseRecord; onDelete: () => void }) {
  const [src, setSrc] = useState<string | null>(
    () => cachedPhotoUrl(record.photoKey) ?? record.photoUrl,
  );

  useEffect(() => {
    if (!record.photoKey) return;
    let cancel = false;
    void hydratePhoto(record.photoKey).then((url) => {
      if (!cancel && url) setSrc(url);
    });
    return () => {
      cancel = true;
    };
  }, [record.photoKey]);

  const accent = record.taken ? 'taken' : 'missed';

  return (
    <article className={`card compact record ${record.taken ? 'pink-border' : 'blue-border'}`}>
      <div className={`thumb ${accent}`}>
        {src ? (
          <img src={src} alt="" />
        ) : (
          <Icon name={SLOTS[record.slot].icon} size={24} />
        )}
      </div>
      <div className="record-copy">
        <div className="record-label">{labelOf(record)}</div>
        <div className={`record-meta ${accent}`}>
          <span>{resultLabel(record.taken)}</span>
          <Icon name={record.syncedAt ? 'cloud_done' : 'cloud_upload'} size={14} />
        </div>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label={`${labelOf(record)} の記録を削除`}
        onClick={onDelete}
      >
        <Icon name="delete" />
      </button>
    </article>
  );
}

function labelOf(record: DoseRecord): string {
  const [year, month, day] = record.date.split('-').map(Number);
  return occurrenceLabel({ date: new Date(year, month - 1, day), slot: record.slot });
}
