import 'dose_slot.dart';

/// 事前画面で登録する内容。
class AppSettings {
  const AppSettings({
    this.recipientEmails = const [],
    this.slots = const [DoseSlot.morning, DoseSlot.evening],
    this.patientName = '',
    this.isCompleted = false,
  });

  /// 記録の送信先。上限 2 件。
  final List<String> recipientEmails;

  /// 服薬する枠（例: 毎日朝晩 → morning, evening）。
  final List<DoseSlot> slots;

  /// メール本文に差し込む名前。空でもよい。
  final String patientName;

  /// 事前設定が完了しているか。
  final bool isCompleted;

  static const int maxRecipients = 2;

  List<DoseSlot> get sortedSlots {
    final sorted = [...slots]
      ..sort((a, b) => a.nominalHour.compareTo(b.nominalHour));
    return sorted;
  }

  String get slotsLabel =>
      sortedSlots.isEmpty ? '未設定' : sortedSlots.map((s) => s.label).join('・');

  AppSettings copyWith({
    List<String>? recipientEmails,
    List<DoseSlot>? slots,
    String? patientName,
    bool? isCompleted,
  }) {
    return AppSettings(
      recipientEmails: recipientEmails ?? this.recipientEmails,
      slots: slots ?? this.slots,
      patientName: patientName ?? this.patientName,
      isCompleted: isCompleted ?? this.isCompleted,
    );
  }

  Map<String, dynamic> toJson() => {
    'recipientEmails': recipientEmails,
    'slots': slots.map((slot) => slot.id).toList(),
    'patientName': patientName,
    'isCompleted': isCompleted,
  };

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    final slotIds = (json['slots'] as List?)?.cast<String>() ?? const [];
    final slots = slotIds
        .map(DoseSlot.tryFromId)
        .whereType<DoseSlot>()
        .toList(growable: false);

    return AppSettings(
      recipientEmails:
          (json['recipientEmails'] as List?)?.cast<String>().toList() ??
          const [],
      slots: slots.isEmpty ? const [DoseSlot.morning, DoseSlot.evening] : slots,
      patientName: json['patientName'] as String? ?? '',
      isCompleted: json['isCompleted'] as bool? ?? false,
    );
  }
}
