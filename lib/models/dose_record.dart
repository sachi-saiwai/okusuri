import 'dose_slot.dart';

/// 1 枠分の服薬記録。
class DoseRecord {
  DoseRecord({
    required this.occurrence,
    required this.taken,
    required this.recordedAt,
    this.photoPath,
    this.photoUrl,
    this.syncedAt,
  });

  final DoseOccurrence occurrence;

  /// true: 飲んだ / false: 飲んでない
  final bool taken;

  final DateTime recordedAt;

  /// 端末内に保存した写真のパス。
  final String? photoPath;

  /// クラウドへアップロード済みの写真 URL。
  final String? photoUrl;

  /// サーバーへ同期できた時刻。null なら未同期。
  final DateTime? syncedAt;

  String get key => occurrence.key;

  bool get isSynced => syncedAt != null;

  String get resultLabel => taken ? '飲んだ' : '飲んでない';

  DoseRecord copyWith({
    bool? taken,
    DateTime? recordedAt,
    String? photoPath,
    String? photoUrl,
    DateTime? syncedAt,
  }) {
    return DoseRecord(
      occurrence: occurrence,
      taken: taken ?? this.taken,
      recordedAt: recordedAt ?? this.recordedAt,
      photoPath: photoPath ?? this.photoPath,
      photoUrl: photoUrl ?? this.photoUrl,
      syncedAt: syncedAt ?? this.syncedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'date': occurrence.key.split('#').first,
    'slot': occurrence.slot.id,
    'taken': taken,
    'recordedAt': recordedAt.toIso8601String(),
    'photoPath': photoPath,
    'photoUrl': photoUrl,
    'syncedAt': syncedAt?.toIso8601String(),
  };

  factory DoseRecord.fromJson(Map<String, dynamic> json) {
    final parts = (json['date'] as String).split('-');
    final occurrence = DoseOccurrence(
      date: DateTime(
        int.parse(parts[0]),
        int.parse(parts[1]),
        int.parse(parts[2]),
      ),
      slot: DoseSlot.fromId(json['slot'] as String),
    );

    return DoseRecord(
      occurrence: occurrence,
      taken: json['taken'] as bool,
      recordedAt: DateTime.parse(json['recordedAt'] as String),
      photoPath: json['photoPath'] as String?,
      photoUrl: json['photoUrl'] as String?,
      syncedAt: json['syncedAt'] == null
          ? null
          : DateTime.parse(json['syncedAt'] as String),
    );
  }
}
