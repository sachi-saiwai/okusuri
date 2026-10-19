import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../models/app_settings.dart';
import '../models/dose_slot.dart';
import '../theme/app_theme.dart';
import '../widgets/soft_card.dart';

/// 事前画面。記録の送信先メールアドレス（上限 2 つ）と薬の頻度を登録する。
/// 設定画面としても同じものを使う。
class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key, this.isOnboarding = false});

  final bool isOnboarding;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final List<TextEditingController> _emailControllers;
  late Set<DoseSlot> _slots;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final settings = AppScope.read(context).settings;
    _nameController = TextEditingController(text: settings.patientName);
    _emailControllers = List.generate(
      AppSettings.maxRecipients,
      (index) => TextEditingController(
        text: index < settings.recipientEmails.length
            ? settings.recipientEmails[index]
            : '',
      ),
    );
    _slots = settings.slots.toSet();
  }

  @override
  void dispose() {
    _nameController.dispose();
    for (final controller in _emailControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  String? _validateEmail(String? value, {required bool required}) {
    final text = (value ?? '').trim();
    if (text.isEmpty) {
      return required ? 'メールアドレスを入力してください' : null;
    }
    final pattern = RegExp(r'^[\w.!#$%&*+/=?^{|}~-]+@[\w-]+(\.[\w-]+)+$');
    if (!pattern.hasMatch(text)) {
      return 'メールアドレスの形式が正しくありません';
    }
    return null;
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_slots.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('薬を飲む時間帯を 1 つ以上選んでください')),
      );
      return;
    }

    setState(() => _isSaving = true);
    final controller = AppScope.read(context);
    final emails = _emailControllers
        .map((c) => c.text.trim())
        .where((text) => text.isNotEmpty)
        .toList();

    await controller.saveSettings(
      controller.settings.copyWith(
        recipientEmails: emails,
        slots: _slots.toList(),
        patientName: _nameController.text.trim(),
        isCompleted: true,
      ),
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (widget.isOnboarding) return; // ルート側が自動でホームへ切り替える
    Navigator.of(context).pop();
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('設定を保存しました')));
  }

  @override
  Widget build(BuildContext context) {
    return SolidScaffold(
      appBar: widget.isOnboarding
          ? null
          : AppBar(title: const Text('設定'), leading: const BackButton()),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
          children: [
            if (widget.isOnboarding) ...[
              const SizedBox(height: 12),
              const _Header(),
              const SizedBox(height: 24),
            ],
            SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle(
                    icon: Icons.person_outline_rounded,
                    title: 'お名前',
                    subtitle: 'メールの件名に使います（任意）',
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _nameController,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(hintText: '例: はなこ'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SoftCard(
              borderColor: AppColors.blue,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle(
                    icon: Icons.medication_outlined,
                    title: '薬を飲む時間帯',
                    subtitle: '選んだ時間帯の分だけ記録します',
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: DoseSlot.values.map((slot) {
                      final selected = _slots.contains(slot);
                      return _SlotChip(
                        slot: slot,
                        selected: selected,
                        onTap: () => setState(() {
                          if (selected) {
                            _slots.remove(slot);
                          } else {
                            _slots.add(slot);
                          }
                        }),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _slots.isEmpty
                        ? '時間帯を選んでください'
                        : '毎日 ${(_slots.toList()..sort((a, b) => a.nominalHour.compareTo(b.nominalHour))).map((s) => s.label).join('・')}',
                    style: const TextStyle(
                      color: AppColors.blueInk,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionTitle(
                    icon: Icons.mail_outline_rounded,
                    title: '記録の送信先',
                    subtitle: '毎朝 8 時に前日分の記録を送ります（上限 2 件）',
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _emailControllers[0],
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: '1 件目（必須）',
                      hintText: 'family1@example.com',
                    ),
                    validator: (value) => _validateEmail(value, required: true),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _emailControllers[1],
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(
                      labelText: '2 件目（任意）',
                      hintText: 'family2@example.com',
                    ),
                    validator: (value) => _validateEmail(value, required: false),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            PrimaryButton(
              label: widget.isOnboarding ? 'この設定ではじめる' : '保存する',
              icon: Icons.check_rounded,
              busy: _isSaving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            color: AppColors.pink,
            borderRadius: BorderRadius.circular(999),
          ),
          child: const Text(
            'おくすり記録',
            style: TextStyle(
              color: AppColors.pinkInk,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'はじめに\n送信先と飲む時間帯を\n登録しましょう',
          style: TextStyle(
            fontSize: 26,
            height: 1.35,
            fontWeight: FontWeight.w800,
            color: AppColors.ink,
          ),
        ),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.pinkSoft,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 20, color: AppColors.pinkDeep),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.inkMuted,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SlotChip extends StatelessWidget {
  const _SlotChip({
    required this.slot,
    required this.selected,
    required this.onTap,
  });

  final DoseSlot slot;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.pinkDeep : Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? AppColors.pinkDeep : AppColors.pink,
              width: 1.6,
            ),
          ),
          child: Row(
            children: [
              Icon(
                slot.icon,
                size: 18,
                color: selected ? Colors.white : AppColors.pinkDeep,
              ),
              const SizedBox(width: 8),
              Text(
                slot.label,
                style: TextStyle(
                  color: selected ? Colors.white : AppColors.ink,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
