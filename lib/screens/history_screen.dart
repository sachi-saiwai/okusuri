import 'dart:io';

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../models/dose_record.dart';
import '../theme/app_theme.dart';
import '../widgets/soft_card.dart';

/// これまでの記録一覧。
class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    final records = controller.records;

    return GradientScaffold(
      appBar: AppBar(title: const Text('記録の履歴')),
      body: records.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'まだ記録がありません',
                  style: TextStyle(color: AppColors.inkMuted),
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              itemCount: records.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final record = records[index];
                return _RecordTile(
                  record: record,
                  onDelete: () => _confirmDelete(context, record),
                );
              },
            ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, DoseRecord record) async {
    final controller = AppScope.read(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text('${record.occurrence.label} の記録を削除しますか？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('やめる'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('削除する'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await controller.deleteRecord(record);
    }
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record, required this.onDelete});

  final DoseRecord record;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final accent = record.taken ? AppColors.pinkDeep : AppColors.blueDeep;

    return SoftCard(
      padding: const EdgeInsets.all(14),
      borderColor: record.taken ? AppColors.pink : AppColors.blue,
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: 58,
              height: 58,
              child: record.photoPath != null &&
                      File(record.photoPath!).existsSync()
                  ? Image.file(File(record.photoPath!), fit: BoxFit.cover)
                  : ColoredBox(
                      color: accent.withValues(alpha: 0.1),
                      child: Icon(
                        record.occurrence.slot.icon,
                        color: accent,
                        size: 24,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.occurrence.label,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      record.resultLabel,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: accent,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Icon(
                      record.isSynced
                          ? Icons.cloud_done_rounded
                          : Icons.cloud_upload_outlined,
                      size: 14,
                      color: AppColors.inkMuted,
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(
              Icons.delete_outline_rounded,
              color: AppColors.inkMuted,
            ),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
