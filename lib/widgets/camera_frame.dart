import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// 枠をタップするとその枠の中でカメラが起動し、写真を撮れるパーツ。
class CameraFrame extends StatefulWidget {
  const CameraFrame({
    super.key,
    required this.photoPath,
    required this.onCaptured,
    required this.onCleared,
    this.enabled = true,
  });

  /// 撮影済みの写真。null なら未撮影。
  final String? photoPath;
  final ValueChanged<String> onCaptured;
  final VoidCallback onCleared;
  final bool enabled;

  @override
  State<CameraFrame> createState() => _CameraFrameState();
}

enum _FrameMode { idle, starting, live }

class _CameraFrameState extends State<CameraFrame> with WidgetsBindingObserver {
  CameraController? _controller;
  _FrameMode _mode = _FrameMode.idle;
  String? _error;
  bool _isCapturing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _stopCamera();
    }
  }

  Future<void> _startCamera() async {
    if (_mode != _FrameMode.idle) return;
    setState(() {
      _mode = _FrameMode.starting;
      _error = null;
    });

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        throw CameraException('no_camera', '利用できるカメラがありません');
      }
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        camera,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _mode = _FrameMode.live;
      });
    } on CameraException catch (error) {
      if (!mounted) return;
      setState(() {
        _mode = _FrameMode.idle;
        _error = error.description ?? 'カメラを起動できませんでした';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _mode = _FrameMode.idle;
        _error = 'カメラを起動できませんでした';
      });
    }
  }

  Future<void> _stopCamera() async {
    final controller = _controller;
    _controller = null;
    if (mounted && _mode != _FrameMode.idle) {
      setState(() => _mode = _FrameMode.idle);
    }
    await controller?.dispose();
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (controller == null || _isCapturing) return;
    setState(() => _isCapturing = true);
    try {
      final file = await controller.takePicture();
      widget.onCaptured(file.path);
      await _stopCamera();
    } on CameraException catch (error) {
      if (mounted) {
        setState(() => _error = error.description ?? '撮影に失敗しました');
      }
    } finally {
      if (mounted) {
        setState(() => _isCapturing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 3 / 4,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFFFF1FD), Color(0xFFF1F8FF)],
          ),
          border: Border.all(color: AppColors.pink, width: 2),
          boxShadow: [
            BoxShadow(
              color: AppColors.pinkDeep.withValues(alpha: 0.1),
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(26),
          child: _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    final photoPath = widget.photoPath;
    if (photoPath != null) {
      return _buildCaptured(photoPath);
    }
    switch (_mode) {
      case _FrameMode.live:
        return _buildLive();
      case _FrameMode.starting:
        return const Center(
          child: CircularProgressIndicator(color: AppColors.pinkDeep),
        );
      case _FrameMode.idle:
        return _buildIdle();
    }
  }

  Widget _buildIdle() {
    return InkWell(
      onTap: widget.enabled ? _startCamera : null,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: AppColors.primaryGradient,
              ),
              child: const Icon(
                Icons.add_a_photo_outlined,
                size: 40,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _error ?? 'タップして薬の写真を撮る',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: _error == null ? AppColors.inkMuted : AppColors.pinkDeep,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLive() {
    final controller = _controller!;
    final previewSize = controller.value.previewSize;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (previewSize == null)
          const ColoredBox(color: Colors.black12)
        else
          FittedBox(
            fit: BoxFit.cover,
            child: SizedBox(
              width: previewSize.height,
              height: previewSize.width,
              child: CameraPreview(controller),
            ),
          ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 16,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _CircleAction(
                icon: Icons.close_rounded,
                background: Colors.white.withValues(alpha: 0.9),
                foreground: AppColors.inkMuted,
                size: 46,
                onTap: _stopCamera,
              ),
              const SizedBox(width: 24),
              _CircleAction(
                icon: Icons.camera_alt_rounded,
                background: AppColors.pinkDeep,
                foreground: Colors.white,
                size: 64,
                busy: _isCapturing,
                onTap: _capture,
              ),
              const SizedBox(width: 24),
              const SizedBox(width: 46),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCaptured(String path) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.file(File(path), fit: BoxFit.cover),
        Positioned(
          right: 12,
          bottom: 12,
          child: Material(
            color: Colors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: widget.enabled ? widget.onCleared : null,
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    Icon(
                      Icons.refresh_rounded,
                      size: 18,
                      color: AppColors.pinkDeep,
                    ),
                    SizedBox(width: 6),
                    Text(
                      '撮り直す',
                      style: TextStyle(
                        color: AppColors.pinkDeep,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({
    required this.icon,
    required this.background,
    required this.foreground,
    required this.size,
    required this.onTap,
    this.busy = false,
  });

  final IconData icon;
  final Color background;
  final Color foreground;
  final double size;
  final VoidCallback onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: busy ? null : onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(
            child: busy
                ? SizedBox(
                    width: size * 0.4,
                    height: size * 0.4,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: foreground,
                    ),
                  )
                : Icon(icon, color: foreground, size: size * 0.42),
          ),
        ),
      ),
    );
  }
}
