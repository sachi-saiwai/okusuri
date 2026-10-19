import 'package:flutter_test/flutter_test.dart';
import 'package:okusuri/models/dose_slot.dart';
import 'package:okusuri/services/dose_schedule.dart';

void main() {
  const slots = [DoseSlot.morning, DoseSlot.evening];

  group('DoseSchedule.next', () {
    test('前日夜の次は今日の朝', () {
      final next = DoseSchedule.next(
        slots: slots,
        now: DateTime(2026, 8, 21, 21),
        lastReported: DoseOccurrence(
          date: DateTime(2026, 8, 20),
          slot: DoseSlot.evening,
        ),
      );

      expect(next.label, '8/21 朝');
    });

    test('今日朝の次は今日の夜', () {
      final next = DoseSchedule.next(
        slots: slots,
        now: DateTime(2026, 8, 21, 9),
        lastReported: DoseOccurrence(
          date: DateTime(2026, 8, 21),
          slot: DoseSlot.morning,
        ),
      );

      expect(next.label, '8/21 夜');
    });

    test('記録がなければ今の時刻に該当する枠を出す', () {
      expect(
        DoseSchedule.next(slots: slots, now: DateTime(2026, 8, 21, 20)).label,
        '8/21 夜',
      );
      expect(
        DoseSchedule.next(slots: slots, now: DateTime(2026, 8, 21, 9)).label,
        '8/21 朝',
      );
      expect(
        DoseSchedule.next(slots: slots, now: DateTime(2026, 8, 21, 5)).label,
        '8/21 朝',
      );
    });

    test('選んでいない枠は飛ばす', () {
      final next = DoseSchedule.next(
        slots: const [DoseSlot.morning],
        now: DateTime(2026, 8, 21, 9),
        lastReported: DoseOccurrence(
          date: DateTime(2026, 8, 21),
          slot: DoseSlot.morning,
        ),
      );

      expect(next.label, '8/22 朝');
    });

    test('3 回服用でも順に進む', () {
      final next = DoseSchedule.next(
        slots: DoseSlot.values,
        now: DateTime(2026, 8, 21, 13),
        lastReported: DoseOccurrence(
          date: DateTime(2026, 8, 21),
          slot: DoseSlot.morning,
        ),
      );

      expect(next.label, '8/21 昼');
    });
  });

  test('DoseOccurrence のキーは日付と枠で一意', () {
    final occurrence = DoseOccurrence(
      date: DateTime(2026, 8, 21, 23, 59),
      slot: DoseSlot.evening,
    );

    expect(occurrence.key, '2026-08-21#evening');
    expect(
      occurrence,
      DoseOccurrence(date: DateTime(2026, 8, 21), slot: DoseSlot.evening),
    );
  });
}
