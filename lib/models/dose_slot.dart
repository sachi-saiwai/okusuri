import 'package:flutter/material.dart';

/// 1日のうちの服薬タイミング。
enum DoseSlot {
  morning('morning', '朝', 8, Icons.wb_twilight_rounded),
  noon('noon', '昼', 12, Icons.wb_sunny_rounded),
  evening('evening', '夜', 19, Icons.nightlight_round);

  const DoseSlot(this.id, this.label, this.nominalHour, this.icon);

  final String id;
  final String label;

  /// 並び順および「今どの枠か」の判定に使う目安の時刻。
  final int nominalHour;
  final IconData icon;

  static DoseSlot fromId(String id) =>
      DoseSlot.values.firstWhere((slot) => slot.id == id);

  static DoseSlot? tryFromId(String? id) {
    if (id == null) return null;
    for (final slot in DoseSlot.values) {
      if (slot.id == id) return slot;
    }
    return null;
  }
}

/// 「8/21 夜」のように、特定の日付と枠の組み合わせ。
@immutable
class DoseOccurrence implements Comparable<DoseOccurrence> {
  DoseOccurrence({required DateTime date, required this.slot})
    : date = DateTime(date.year, date.month, date.day);

  final DateTime date;
  final DoseSlot slot;

  String get key =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}#${slot.id}';

  String get dateLabel => '${date.month}/${date.day}';

  String get label => '$dateLabel ${slot.label}';

  DateTime get nominalTime =>
      DateTime(date.year, date.month, date.day, slot.nominalHour);

  @override
  int compareTo(DoseOccurrence other) {
    final byDate = date.compareTo(other.date);
    if (byDate != 0) return byDate;
    return slot.nominalHour.compareTo(other.slot.nominalHour);
  }

  bool isBefore(DoseOccurrence other) => compareTo(other) < 0;

  bool isAfter(DoseOccurrence other) => compareTo(other) > 0;

  @override
  bool operator ==(Object other) =>
      other is DoseOccurrence && other.key == key;

  @override
  int get hashCode => key.hashCode;

  @override
  String toString() => label;
}
