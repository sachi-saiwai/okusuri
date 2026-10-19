import { describe, expect, it } from 'vitest';
import { recordKey } from './models';
import {
  nextDose,
  nextReportTime,
  occurrenceLabel,
  type DoseOccurrence,
} from './schedule';

function at(year: number, month: number, day: number, hour = 0): Date {
  return new Date(year, month - 1, day, hour);
}

function reported(
  year: number,
  month: number,
  day: number,
  slot: DoseOccurrence['slot'],
): DoseOccurrence {
  return { date: at(year, month, day), slot };
}

describe('nextDose', () => {
  const slots = ['morning', 'evening'] as const;

  it('前日夜の次は今日の朝', () => {
    const next = nextDose(slots, at(2026, 8, 21, 21), reported(2026, 8, 20, 'evening'));
    expect(occurrenceLabel(next)).toBe('8/21 朝');
  });

  it('今日朝の次は今日の夜', () => {
    const next = nextDose(slots, at(2026, 8, 21, 9), reported(2026, 8, 21, 'morning'));
    expect(occurrenceLabel(next)).toBe('8/21 夜');
  });

  it('記録がなければ今の時刻に該当する枠を出す', () => {
    expect(occurrenceLabel(nextDose(slots, at(2026, 8, 21, 20)))).toBe('8/21 夜');
    expect(occurrenceLabel(nextDose(slots, at(2026, 8, 21, 9)))).toBe('8/21 朝');
    expect(occurrenceLabel(nextDose(slots, at(2026, 8, 21, 5)))).toBe('8/21 朝');
  });

  it('選んでいない枠は飛ばす', () => {
    const next = nextDose(['morning'], at(2026, 8, 21, 9), reported(2026, 8, 21, 'morning'));
    expect(occurrenceLabel(next)).toBe('8/22 朝');
  });

  it('3 回服用でも順に進む', () => {
    const next = nextDose(
      ['morning', 'noon', 'evening'],
      at(2026, 8, 21, 13),
      reported(2026, 8, 21, 'morning'),
    );
    expect(occurrenceLabel(next)).toBe('8/21 昼');
  });
});

it('記録キーは日付と枠で一意', () => {
  expect(recordKey({ date: '2026-08-21', slot: 'evening' })).toBe('2026-08-21#evening');
  expect(occurrenceLabel({ date: at(2026, 8, 21, 23), slot: 'evening' })).toBe('8/21 夜');
});

it('送信予定は 8 時前なら当日、8 時以降は翌日', () => {
  expect(nextReportTime(at(2026, 8, 21, 7)).getDate()).toBe(21);
  expect(nextReportTime(at(2026, 8, 21, 7)).getHours()).toBe(8);
  expect(nextReportTime(at(2026, 8, 21, 8)).getDate()).toBe(22);
  expect(nextReportTime(at(2026, 8, 21, 9)).getDate()).toBe(22);
});
