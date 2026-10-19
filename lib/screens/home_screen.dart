import 'dart:io';

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../models/dose_record.dart';
import '../services/app_controller.dart';
import '../theme/app_theme.dart';
import '../widgets/camera_frame.dart';
import '../widgets/soft_card.dart';
import 'history_screen.dart';
import 'setup_screen.dart';

/// 記録画面。次に報告する枠を出し、写真を撮って「飲んだ / 飲んでない」を記録する。
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _photoPath;

  Future<void> _submit(AppController controller, {required bool taken}) async {
    if (taken && _photoPath == null) {
      final proceed = await _confirmWithoutPhoto();
      if (proceed != true) return;
    }

    await controller.submit(taken: taken, photoSourcePath: _photoPath);
    if (!mounted) return;
    setState(() => _photoPath = null);
  }

  Future<bool?> _confirmWithoutPhoto() {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        title: const Text('写真なしで記録しますか？'),
        content: const Text('写真があると、飲んだ様子もあわせて家族に届きます。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('写真を撮る'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('写真なしで記録'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final submitted = controller.lastSubmitted;

    return GradientScaffold(
      appBar: AppBar(
        title: const Text('おくすり記録'),
        actions: [
          IconButton(
            tooltip: '履歴',
            icon: const Icon(Icons.history_rounded),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const HistoryScreen()),
            ),
          ),
          IconButton(
            tooltip: '設定',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SetupScreen()),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          _OccurrenceHeader(controller: controller),
          const SizedBox(height: 20),
          if (submitted == null) ...[
            CameraFrame(
              photoPath: _photoPath,
              enabled: !controller.isSubmitting,
              onCaptured: (path) => setState(() => _photoPath = path),
              onCleared: () => setState(() => _photoPath = null),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ChoiceButton(
                    label: '飲んでない',
                    icon: Icons.remove_circle_outline_rounded,
                    accent: AppColors.blueDeep,
                    onPressed: controller.isSubmitting
                        ? null
                        : () => _submit(controller, taken: false),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: ChoiceButton(
                    label: '飲んだ',
                    icon: Icons.check_circle_outline_rounded,
                    accent: AppColors.pinkDeep,
                    filled: true,
                    onPressed: controller.isSubmitting
                        ? null
                        : () => _submit(controller, taken: true),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const _Hint(),
          ] else
            _RecordedCard(controller: controller, record: submitted),
          if (!controller.isCloudEnabled) ...[
            const SizedBox(height: 20),
            const _OfflineNotice(),
          ],
        ],
      ),
    );
  }
}

class _OccurrenceHeader extends StatelessWidget {
  const _OccurrenceHeader({required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final occurrence = controller.currentOccurrence;
    final name = controller.settings.patientName;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            name.isEmpty ? '今回の記録' : '$name さんの記録',
            style: const TextStyle(
              color: AppColors.pinkInk,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              occurrence.dateLabel,
              style: const TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.w800,
                height: 1.1,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.pink.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(
                    occurrence.slot.icon,
                    size: 20,
                    color: AppColors.pinkInk,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    occurrence.slot.label,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.pinkInk,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          '毎日 ${controller.settings.slotsLabel} の記録',
          style: const TextStyle(fontSize: 13, color: AppColors.inkMuted),
        ),
      ],
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.schedule_rounded, size: 15, color: AppColors.inkMuted),
        SizedBox(width: 6),
        Text(
          '記録は翌朝 8 時に家族へ届きます',
          style: TextStyle(fontSize: 12.5, color: AppColors.inkMuted),
        ),
      ],
    );
  }
}

/// 記録完了の表示。
class _RecordedCard extends StatelessWidget {
  const _RecordedCard({required this.controller, required this.record});

  final AppController controller;
  final DoseRecord record;

  @override
  Widget build(BuildContext context) {
    final accent = record.taken ? AppColors.pinkDeep : AppColors.blueDeep;
    final sendTime = controller.nextReportTime;
    final recipients = controller.settings.recipientEmails;

    return SoftCard(
      borderColor: record.taken ? AppColors.pink : AppColors.blue,
      padding: const EdgeInsets.all(22),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: accent.withValues(alpha: 0.12),
            ),
            child: Icon(
              record.taken
                  ? Icons.check_circle_rounded
                  : Icons.info_outline_rounded,
              color: accent,
              size: 34,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            '${record.occurrence.label} を記録しました',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              record.resultLabel,
              style: TextStyle(
                color: accent,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
          ),
          if (record.photoPath != null) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: Image.file(
                File(record.photoPath!),
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
          ],
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.blueSoft,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.send_rounded,
                      size: 16,
                      color: AppColors.blueInk,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${sendTime.month}/${sendTime.day} 8:00 に送信予定',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.blueInk,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  recipients.isEmpty ? '送信先が未登録です' : recipients.join('\n'),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.inkMuted,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      record.isSynced
                          ? Icons.cloud_done_rounded
                          : Icons.cloud_upload_outlined,
                      size: 15,
                      color: AppColors.inkMuted,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      record.isSynced ? 'サーバーへ送信済み' : 'この端末に保存済み（次回の接続時に送信）',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: AppColors.inkMuted,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          GradientButton(
            label: '次の記録へ',
            icon: Icons.arrow_forward_rounded,
            onPressed: controller.dismissConfirmation,
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: () async {
              await controller.undoLastSubmitted();
            },
            child: const Text(
              'この記録を取り消す',
              style: TextStyle(color: AppColors.inkMuted),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.pinkSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.pink),
      ),
      child: const Row(
        children: [
          Icon(Icons.cloud_off_rounded, size: 18, color: AppColors.pinkDeep),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              '送信サーバーに未接続です。記録は端末に保存され、接続後にまとめて送信されます。',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.pinkInk,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
