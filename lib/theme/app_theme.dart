import 'package:flutter/material.dart';

/// 配色は #FDCCF9 のパステルピンクを基調に、アクセントとして淡いブルーを重ねる。
class AppColors {
  const AppColors._();

  static const Color pink = Color(0xFFFDCCF9);
  static const Color pinkSoft = Color(0xFFFFF0FD);
  static const Color pinkDeep = Color(0xFFD86FC4);
  static const Color pinkInk = Color(0xFF8E3F80);

  static const Color blue = Color(0xFFCCE7FD);
  static const Color blueSoft = Color(0xFFF0F7FF);
  static const Color blueDeep = Color(0xFF5A9FD4);
  static const Color blueInk = Color(0xFF2F6C99);

  static const Color ink = Color(0xFF4A3B52);
  static const Color inkMuted = Color(0xFF8B7E93);
  static const Color surface = Color(0xFFFFFBFE);

  /// 単色背景の画面で使う下地。
  static const Color canvas = Color(0xFFFFF8FD);

  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [pinkSoft, Color(0xFFFDE9FB), blueSoft],
    stops: [0.0, 0.45, 1.0],
  );

  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFFDCCF9), Color(0xFFCCE7FD)],
  );
}

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.pink,
      primary: AppColors.pinkDeep,
      onPrimary: Colors.white,
      primaryContainer: AppColors.pink,
      onPrimaryContainer: AppColors.pinkInk,
      secondary: AppColors.blueDeep,
      onSecondary: Colors.white,
      secondaryContainer: AppColors.blue,
      onSecondaryContainer: AppColors.blueInk,
      surface: AppColors.surface,
      onSurface: AppColors.ink,
    );

    final base = ThemeData(colorScheme: colorScheme, useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: Colors.transparent,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        foregroundColor: AppColors.ink,
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.4,
        ),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.ink,
        displayColor: AppColors.ink,
      ),
      cardTheme: CardThemeData(
        color: Colors.white.withValues(alpha: 0.82),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.9),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.pink),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.pink, width: 1.4),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.blueDeep, width: 1.8),
        ),
        labelStyle: const TextStyle(color: AppColors.inkMuted),
        hintStyle: const TextStyle(color: AppColors.inkMuted),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.pinkInk,
        contentTextStyle: const TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.pink,
        thickness: 1,
        space: 24,
      ),
    );
  }
}

/// 単色背景の画面。
class SolidScaffold extends StatelessWidget {
  const SolidScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.background = AppColors.canvas,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: background,
      appBar: appBar,
      body: SafeArea(child: body),
    );
  }
}

/// 全画面共通のグラデーション背景。
class GradientScaffold extends StatelessWidget {
  const GradientScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.bottomInsetSafe = true,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final bool bottomInsetSafe;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: appBar,
        body: SafeArea(bottom: bottomInsetSafe, child: body),
      ),
    );
  }
}
