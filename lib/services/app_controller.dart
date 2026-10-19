import 'package:flutter/foundation.dart';

import '../models/app_settings.dart';
import '../models/dose_record.dart';
import '../models/dose_slot.dart';
import 'cloud_sync.dart';
import 'dose_schedule.dart';
import 'local_store.dart';

/// 画面から使うアプリ状態のまとめ役。
class AppController extends ChangeNotifier {
  AppController({LocalStore? store, PhotoStore? photos, CloudSync? cloud})
    : _store = store ?? LocalStore(),
      _photos = photos ?? PhotoStore(),
      _cloud = cloud ?? CloudSync();

  final LocalStore _store;
  final PhotoStore _photos;
  final CloudSync _cloud;

  AppSettings _settings = const AppSettings();
  List<DoseRecord> _records = [];
  DoseRecord? _lastSubmitted;
  bool _isLoading = true;
  bool _isSubmitting = false;

  AppSettings get settings => _settings;
  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  bool get isCloudEnabled => _cloud.isAvailable;

  /// 直近に記録した内容。画面内で完了表示に使う。
  DoseRecord? get lastSubmitted => _lastSubmitted;

  /// 新しい順の記録一覧。
  List<DoseRecord> get records {
    final sorted = [..._records]
      ..sort((a, b) => b.occurrence.compareTo(a.occurrence));
    return sorted;
  }

  bool get hasUnsyncedRecords => _records.any((record) => !record.isSynced);

  /// 次に報告する枠。
  DoseOccurrence get currentOccurrence {
    DoseOccurrence? last;
    for (final record in _records) {
      if (last == null || record.occurrence.isAfter(last)) {
        last = record.occurrence;
      }
    }
    return DoseSchedule.next(
      slots: _settings.sortedSlots,
      now: DateTime.now(),
      lastReported: last,
    );
  }

  /// 翌朝 8 時の送信予定日時。
  DateTime get nextReportTime {
    final now = DateTime.now();
    final todayEight = DateTime(now.year, now.month, now.day, 8);
    return now.isBefore(todayEight)
        ? todayEight
        : todayEight.add(const Duration(days: 1));
  }

  Future<void> load() async {
    _isLoading = true;
    notifyListeners();

    _settings = await _store.loadSettings();
    _records = await _store.loadRecords();
    _isLoading = false;
    notifyListeners();

    await _cloud.initialize();
    notifyListeners();
    await syncPending();
  }

  Future<void> saveSettings(AppSettings settings) async {
    _settings = settings;
    await _store.saveSettings(settings);
    notifyListeners();
    await _cloud.pushSettings(settings);
  }

  /// 記録して端末に保存し、可能ならクラウドへ送る。
  Future<void> submit({required bool taken, String? photoSourcePath}) async {
    if (_isSubmitting) return;
    _isSubmitting = true;
    notifyListeners();

    try {
      final occurrence = currentOccurrence;
      String? photoPath;
      if (photoSourcePath != null) {
        photoPath = await _photos.save(
          sourcePath: photoSourcePath,
          key: occurrence.key,
        );
      }

      var record = DoseRecord(
        occurrence: occurrence,
        taken: taken,
        recordedAt: DateTime.now(),
        photoPath: photoPath,
      );

      _records = [..._records.where((r) => r.key != record.key), record];
      await _store.saveRecords(_records);
      _lastSubmitted = record;
      _isSubmitting = false;
      notifyListeners();

      record = await _cloud.pushRecord(record);
      _replace(record);
      await _store.saveRecords(_records);
      notifyListeners();
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  Future<void> undoLastSubmitted() async {
    final target = _lastSubmitted;
    if (target == null) return;
    await deleteRecord(target);
  }

  Future<void> deleteRecord(DoseRecord record) async {
    _records = _records.where((r) => r.key != record.key).toList();
    if (_lastSubmitted?.key == record.key) {
      _lastSubmitted = null;
    }
    await _store.saveRecords(_records);
    await _photos.delete(record.photoPath);
    notifyListeners();
    await _cloud.deleteRecord(record.key);
  }

  void dismissConfirmation() {
    _lastSubmitted = null;
    notifyListeners();
  }

  /// 未同期の記録をまとめて送り直す。
  Future<void> syncPending() async {
    if (!_cloud.isAvailable) return;
    var changed = false;
    for (final record in [..._records]) {
      if (record.isSynced) continue;
      final synced = await _cloud.pushRecord(record);
      if (synced.isSynced) {
        _replace(synced);
        changed = true;
      }
    }
    if (changed) {
      await _store.saveRecords(_records);
      notifyListeners();
    }
  }

  void _replace(DoseRecord record) {
    _records = _records
        .map((r) => r.key == record.key ? record : r)
        .toList(growable: false);
    if (_lastSubmitted?.key == record.key) {
      _lastSubmitted = record;
    }
  }
}
