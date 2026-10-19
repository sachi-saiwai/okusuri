import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'screens/home_screen.dart';
import 'screens/setup_screen.dart';
import 'services/app_controller.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const OkusuriApp());
}

class OkusuriApp extends StatefulWidget {
  const OkusuriApp({super.key});

  @override
  State<OkusuriApp> createState() => _OkusuriAppState();
}

class _OkusuriAppState extends State<OkusuriApp> {
  final AppController _controller = AppController();
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _controller.load();
    _lifecycle = AppLifecycleListener(
      onResume: () => _controller.syncPending(),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      controller: _controller,
      child: MaterialApp(
        title: 'おくすり記録',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const _RootRouter(),
      ),
    );
  }
}

class _RootRouter extends StatelessWidget {
  const _RootRouter();

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);

    if (controller.isLoading) {
      return const GradientScaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.pinkDeep)),
      );
    }
    if (!controller.settings.isCompleted) {
      return const SetupScreen(isOnboarding: true);
    }
    return const HomeScreen();
  }
}
