import { useState } from 'react';
import { appController, useSnapshot } from './controller';
import { SLOTS, slotsLabel, type SlotId } from './models';
import { pushToast } from './toast';
import { Button, Icon, TopBar } from './ui';

const EMAIL_PATTERN = /^[\w.!#$%&*+/=?^{|}~-]+@[\w-]+(\.[\w-]+)+$/;

function validateEmail(value: string, required: boolean): string | null {
  const text = value.trim();
  if (!text) return required ? 'メールアドレスを入力してください' : null;
  if (!EMAIL_PATTERN.test(text)) return 'メールアドレスの形式が正しくありません';
  return null;
}

export function SetupScreen({
  onboarding,
  onSaved,
  onBack,
}: {
  onboarding: boolean;
  onSaved?: () => void;
  onBack?: () => void;
}) {
  const snap = useSnapshot();
  const [name, setName] = useState(snap.settings.patientName);
  const [emails, setEmails] = useState<string[]>([
    snap.settings.recipientEmails[0] ?? '',
    snap.settings.recipientEmails[1] ?? '',
  ]);
  const [errors, setErrors] = useState<string[]>(['', '']);
  const [slots, setSlots] = useState<SlotId[]>(snap.settings.slots);
  const [saving, setSaving] = useState(false);

  const ordered = [...slots].sort((a, b) => SLOTS[a].nominalHour - SLOTS[b].nominalHour);

  function toggle(slot: SlotId) {
    setSlots((current) =>
      current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot],
    );
  }

  async function save() {
    const nextErrors = [
      validateEmail(emails[0] ?? '', true) ?? '',
      validateEmail(emails[1] ?? '', false) ?? '',
    ];
    setErrors(nextErrors);
    if (nextErrors.some(Boolean)) return;
    if (slots.length === 0) {
      pushToast('薬を飲む時間帯を 1 つ以上選んでください');
      return;
    }

    setSaving(true);
    try {
      await appController.saveSettings({
        recipientEmails: emails,
        slots,
        patientName: name,
        isCompleted: true,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app solid">
      <div className="shell">
        {!onboarding && <TopBar title="設定" onBack={onBack} />}
        <form
          className="page stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {onboarding && (
            <div className="hero-wrap">
              <span className="brand-pill">おくすり記録</span>
              <h2 className="hero">{'はじめに\n送信先と飲む時間帯を\n登録しましょう'}</h2>
            </div>
          )}

          <section className="card">
            <div className="section-title">
              <span className="section-icon">
                <Icon name="person" size={20} />
              </span>
              <div>
                <h2>お名前</h2>
                <p>メールの件名に使います（任意）</p>
              </div>
            </div>
            <label className="field">
              <span className="visually-hidden">お名前</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例: はなこ"
                autoComplete="name"
              />
            </label>
          </section>

          <section className="card blue-border">
            <div className="section-title">
              <span className="section-icon">
                <Icon name="medication" size={20} />
              </span>
              <div>
                <h2>薬を飲む時間帯</h2>
                <p>選んだ時間帯の分だけ記録します</p>
              </div>
            </div>
            <div className="chips" role="group" aria-label="薬を飲む時間帯">
              {(['morning', 'noon', 'evening'] as const).map((slot) => {
                const selected = slots.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    className={selected ? 'chip selected' : 'chip'}
                    aria-pressed={selected}
                    onClick={() => toggle(slot)}
                  >
                    <Icon name={SLOTS[slot].icon} size={18} />
                    {SLOTS[slot].label}
                  </button>
                );
              })}
            </div>
            <p className="slot-note">
              {slots.length === 0 ? '時間帯を選んでください' : `毎日 ${slotsLabel(ordered)}`}
            </p>
          </section>

          <section className="card">
            <div className="section-title">
              <span className="section-icon">
                <Icon name="mail" size={20} />
              </span>
              <div>
                <h2>記録の送信先</h2>
                <p>毎朝 8 時に前日分の記録を送ります（上限 2 件）</p>
              </div>
            </div>
            <label className="field">
              <span>1 件目（必須）</span>
              <input
                value={emails[0]}
                onChange={(event) => {
                  const value = event.target.value;
                  setEmails((current) => [value, current[1] ?? '']);
                  setErrors((current) => ['', current[1] ?? '']);
                }}
                placeholder="family1@example.com"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {errors[0] && <small className="error">{errors[0]}</small>}
            </label>
            <label className="field">
              <span>2 件目（任意）</span>
              <input
                value={emails[1]}
                onChange={(event) => {
                  const value = event.target.value;
                  setEmails((current) => [current[0] ?? '', value]);
                  setErrors((current) => [current[0] ?? '', '']);
                }}
                placeholder="family2@example.com"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {errors[1] && <small className="error">{errors[1]}</small>}
            </label>
          </section>

          <div className="actions">
            <Button
              type="submit"
              variant="primary"
              icon="check"
              busy={saving}
              label={onboarding ? 'この設定ではじめる' : '保存する'}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
