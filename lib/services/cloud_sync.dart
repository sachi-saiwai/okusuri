import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

import '../firebase_options.dart';
import '../models/app_settings.dart';
import '../models/dose_record.dart';

/// Firebase への同期。翌朝 8 時の送信は Cloud Functions 側が担当するため、
/// アプリの役目は「設定」と「記録」を確実に置いてくること。
///
/// Firebase に繋がらない環境でもアプリ自体は動かせるよう、
/// 初期化失敗はローカル専用モードとして扱う。
class CloudSync {
  FirebaseFirestore? _firestore;
  FirebaseStorage? _storage;
  String? _uid;
  String? _lastError;

  bool get isAvailable => _firestore != null && _uid != null;
  String? get userId => _uid;
  String? get lastError => _lastError;

  Future<void> initialize() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      }
      final auth = FirebaseAuth.instance;
      final credential = auth.currentUser ?? (await auth.signInAnonymously()).user;
      _uid = credential?.uid;
      _firestore = FirebaseFirestore.instance;
      _storage = FirebaseStorage.instance;
      _lastError = null;
    } catch (error) {
      _firestore = null;
      _storage = null;
      _uid = null;
      _lastError = error.toString();
      debugPrint('CloudSync 無効（ローカル保存のみで動作します）: $error');
    }
  }

  DocumentReference<Map<String, dynamic>>? get _household {
    final firestore = _firestore;
    final uid = _uid;
    if (firestore == null || uid == null) return null;
    return firestore.collection('households').doc(uid);
  }

  Future<void> pushSettings(AppSettings settings) async {
    final household = _household;
    if (household == null) return;

    final data = <String, dynamic>{
      'recipientEmails': settings.recipientEmails,
      'slots': settings.sortedSlots.map((slot) => slot.id).toList(),
      'patientName': settings.patientName,
      'timezone': 'Asia/Tokyo',
      'updatedAt': FieldValue.serverTimestamp(),
    };
    // createdAt は利用開始前の日付を報告しないための基準なので初回だけ書く。
    if (!(await household.get()).exists) {
      data['createdAt'] = FieldValue.serverTimestamp();
    }
    await household.set(data, SetOptions(merge: true));
  }

  /// 記録を送信し、写真 URL と同期時刻を埋めた記録を返す。
  Future<DoseRecord> pushRecord(DoseRecord record) async {
    final household = _household;
    if (household == null) return record;

    final photoUrl = record.photoUrl ?? await _uploadPhoto(record);
    final doc = household.collection('records').doc(record.key);

    final data = <String, dynamic>{
      'date': record.key.split('#').first,
      'slot': record.occurrence.slot.id,
      'slotLabel': record.occurrence.slot.label,
      'taken': record.taken,
      'photoUrl': photoUrl,
      'photoStoragePath': photoUrl == null ? null : _photoPath(record.key),
      'recordedAt': Timestamp.fromDate(record.recordedAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
    // 再送時に reportedAt を null で塗り潰すと二重送信になるため初回だけ書く。
    if (!(await doc.get()).exists) {
      data['reportedAt'] = null;
    }
    await doc.set(data, SetOptions(merge: true));

    return record.copyWith(photoUrl: photoUrl, syncedAt: DateTime.now());
  }

  String _photoPath(String key) => 'households/$_uid/photos/$key.jpg';

  Future<String?> _uploadPhoto(DoseRecord record) async {
    final storage = _storage;
    final uid = _uid;
    final path = record.photoPath;
    if (storage == null || uid == null || path == null) return null;
    final file = File(path);
    if (!file.existsSync()) return null;

    final ref = storage.ref(_photoPath(record.key));
    await ref.putFile(file, SettableMetadata(contentType: 'image/jpeg'));
    return ref.getDownloadURL();
  }

  Future<void> deleteRecord(String key) async {
    final household = _household;
    if (household == null) return;
    await household.collection('records').doc(key).delete();
    final uid = _uid;
    if (uid != null) {
      try {
        await _storage?.ref(_photoPath(key)).delete();
      } catch (_) {
        // 写真が無い記録では 404 になるので無視する。
      }
    }
  }
}
