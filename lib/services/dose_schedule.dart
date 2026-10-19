import '../models/dose_slot.dart';

/// 「次に報告すべき枠」を求める純粋なロジック。
///
/// 最後の報告の次の枠を返す。
/// 例) 最後の報告が前日夜なら今日の朝、最後の報告が今日朝なら今日の夜。
class DoseSchedule {
  const DoseSchedule._();

  static DoseOccurrence next({
    required List<DoseSlot> slots,
    required DateTime now,
    DoseOccurrence? lastReported,
  }) {
    final ordered = _ordered(slots);

    if (lastReported == null) {
      return _currentOrFirst(ordered, now);
    }
    return _after(ordered, lastReported);
  }

  static List<DoseSlot> _ordered(List<DoseSlot> slots) {
    final ordered = slots.toSet().toList()
      ..sort((a, b) => a.nominalHour.compareTo(b.nominalHour));
    return ordered.isEmpty ? const [DoseSlot.morning] : ordered;
  }

  /// まだ 1 件も記録がないとき。今の時刻に一番近い（過ぎている）枠を出す。
  static DoseOccurrence _currentOrFirst(List<DoseSlot> ordered, DateTime now) {
    final due = ordered.where((slot) => slot.nominalHour <= now.hour).toList();
    final slot = due.isEmpty ? ordered.first : due.last;
    return DoseOccurrence(date: now, slot: slot);
  }

  static DoseOccurrence _after(
    List<DoseSlot> ordered,
    DoseOccurrence previous,
  ) {
    final laterToday = ordered
        .where((slot) => slot.nominalHour > previous.slot.nominalHour)
        .toList();

    if (laterToday.isNotEmpty) {
      return DoseOccurrence(date: previous.date, slot: laterToday.first);
    }
    return DoseOccurrence(
      date: previous.date.add(const Duration(days: 1)),
      slot: ordered.first,
    );
  }
}
