import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:missed_lead_recovery/l10n/generated/app_localizations.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/demo_config.dart';
import '../config/supabase_config.dart';
import '../providers/contractor_provider.dart';
import '../theme/app_colors.dart';

/// Bottom sheet that lets the user record a custom voicemail greeting,
/// preview it, and upload it to Supabase Storage.
class VoicemailRecorderSheet extends ConsumerStatefulWidget {
  final String locale;

  const VoicemailRecorderSheet({super.key, required this.locale});

  @override
  ConsumerState<VoicemailRecorderSheet> createState() =>
      _VoicemailRecorderSheetState();
}

enum _RecordState { idle, recording, recorded, uploading, done }

class _VoicemailRecorderSheetState
    extends ConsumerState<VoicemailRecorderSheet> {
  final _recorder = AudioRecorder();
  final _player = AudioPlayer();

  _RecordState _state = _RecordState.idle;
  String? _recordedPath;
  Duration _elapsed = Duration.zero;
  Timer? _elapsedTimer;
  bool _isPlaying = false;
  String? _errorMessage;
  StreamSubscription? _playerSub;

  @override
  void dispose() {
    _elapsedTimer?.cancel();
    _playerSub?.cancel();
    _recorder.dispose();
    _player.dispose();
    super.dispose();
  }

  // ─── Permission ──────────────────────────────────────────────────────

  Future<bool> _requestMic() async {
    final status = await Permission.microphone.request();
    if (status.isDenied || status.isPermanentlyDenied) {
      if (mounted) {
        setState(() => _errorMessage =
            'Microphone permission required to record a greeting.');
      }
      return false;
    }
    return true;
  }

  // ─── Recording ───────────────────────────────────────────────────────

  Future<void> _startRecording() async {
    if (!await _requestMic()) return;

    // Stop any existing playback
    await _player.stop();
    setState(() => _isPlaying = false);

    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/voicemail_${widget.locale}.m4a';

    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 22050,
      ),
      path: path,
    );

    setState(() {
      _state = _RecordState.recording;
      _recordedPath = path;
      _elapsed = Duration.zero;
      _errorMessage = null;
    });

    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsed += const Duration(seconds: 1));
    });
  }

  Future<void> _stopRecording() async {
    _elapsedTimer?.cancel();
    await _recorder.stop();
    setState(() => _state = _RecordState.recorded);
  }

  // ─── Playback ────────────────────────────────────────────────────────

  Future<void> _togglePlayback() async {
    if (_recordedPath == null) return;

    if (_isPlaying) {
      await _player.stop();
      setState(() => _isPlaying = false);
      return;
    }

    await _player.setFilePath(_recordedPath!);
    setState(() => _isPlaying = true);
    _player.play();

    _playerSub?.cancel();
    _playerSub = _player.playerStateStream.listen((s) {
      if (s.processingState == ProcessingState.completed && mounted) {
        setState(() => _isPlaying = false);
      }
    });
  }

  // ─── Upload ──────────────────────────────────────────────────────────

  Future<void> _upload() async {
    if (_recordedPath == null) return;

    setState(() {
      _state = _RecordState.uploading;
      _errorMessage = null;
    });

    try {
      if (!isDemo) {
        final contractorId = supabase.auth.currentUser?.id;
        if (contractorId == null) throw Exception('Not authenticated');

        final bytes = await File(_recordedPath!).readAsBytes();

        // Upload to Supabase Storage: voicemails/{contractorId}/{locale}.mp3
        await supabase.storage.from('voicemails').uploadBinary(
          '$contractorId/${widget.locale}.mp3',
          bytes,
          fileOptions: const FileOptions(
            contentType: 'audio/mpeg',
            upsert: true,
          ),
        );
      }

      // Update contractor voicemail_config to 'custom'
      final c = ref.read(contractorProvider).valueOrNull;
      if (c != null) {
        final updatedConfig =
            Map<String, Map<String, String>>.from(c.voicemailConfig);
        updatedConfig[widget.locale] = {'type': 'custom'};
        await ref
            .read(contractorProvider.notifier)
            .updateSettings({'voicemail_config': updatedConfig});
      }

      setState(() => _state = _RecordState.done);

      // Auto-close after success feedback
      await Future.delayed(const Duration(milliseconds: 1200));
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() {
        _state = _RecordState.recorded;
        _errorMessage = 'Upload failed: $e';
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _localeName(String locale, AppLocalizations l10n) {
    switch (locale) {
      case 'fi':
        return l10n.voicemailLocaleFi;
      case 'en':
        return l10n.voicemailLocaleEn;
      case 'pt':
        return l10n.voicemailLocalePt;
      default:
        return locale.toUpperCase();
    }
  }

  // ─── Build ───────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = AppColors.of(context);

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: colors.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Drag handle
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.borderSubtle,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),

            // ── Title
            Text(
              '${l10n.voicemailTypeCustom} — ${_localeName(widget.locale, l10n)}',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.voicemailSubtitle,
              style: TextStyle(fontSize: 12, color: colors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            // ── Center button (record / stop / spinner)
            _buildCenterButton(colors, l10n),
            const SizedBox(height: 12),

            // ── Status label / timer
            _buildStatusLabel(colors, l10n),
            const SizedBox(height: 24),

            // ── Error message
            if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _errorMessage!,
                  style: TextStyle(color: colors.accentDanger, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ),

            // ── Action row (preview + save) shown after recording
            if (_state == _RecordState.recorded) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _togglePlayback,
                      icon: Icon(_isPlaying
                          ? Icons.stop_rounded
                          : Icons.play_arrow_rounded),
                      label: Text(_isPlaying
                          ? l10n.voicemailPlaying
                          : l10n.voicemailPlay),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: colors.accentPrimary,
                        side: BorderSide(color: colors.accentPrimary),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _upload,
                      icon: const Icon(Icons.cloud_upload_rounded),
                      label: Text(l10n.voicemailUpload),
                      style: FilledButton.styleFrom(
                        backgroundColor: colors.accentPrimary,
                        foregroundColor: colors.textInverse,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // Re-record link
              TextButton(
                onPressed: _startRecording,
                child: Text(
                  l10n.voicemailRecord,
                  style: TextStyle(color: colors.textSecondary, fontSize: 13),
                ),
              ),
            ],

            // ── Done state
            if (_state == _RecordState.done)
              Column(
                children: [
                  Icon(Icons.check_circle_rounded,
                      color: colors.accentSuccess, size: 52),
                  const SizedBox(height: 8),
                  Text(
                    l10n.voicemailUploadSuccess,
                    style: TextStyle(
                      color: colors.accentSuccess,
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCenterButton(AppColors colors, AppLocalizations l10n) {
    switch (_state) {
      case _RecordState.idle:
      case _RecordState.recorded:
        return GestureDetector(
          onTap: _startRecording,
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _state == _RecordState.idle
                  ? colors.accentDanger
                  : colors.accentDanger.withValues(alpha: 0.7),
              boxShadow: [
                BoxShadow(
                  color: colors.accentDanger.withValues(alpha: 0.35),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(Icons.mic, color: Colors.white, size: 36),
          ),
        );

      case _RecordState.recording:
        // Pulsing stop button
        return GestureDetector(
          onTap: _stopRecording,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.92, end: 1.06),
            duration: const Duration(milliseconds: 650),
            curve: Curves.easeInOut,
            builder: (_, scale, child) =>
                Transform.scale(scale: scale, child: child),
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.accentDanger,
                boxShadow: [
                  BoxShadow(
                    color: colors.accentDanger.withValues(alpha: 0.55),
                    blurRadius: 28,
                    spreadRadius: 6,
                  ),
                ],
              ),
              child: const Icon(Icons.stop_rounded,
                  color: Colors.white, size: 36),
            ),
          ),
        );

      case _RecordState.uploading:
        return SizedBox(
          width: 80,
          height: 80,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: colors.accentPrimary,
          ),
        );

      case _RecordState.done:
        return const SizedBox.shrink();
    }
  }

  Widget _buildStatusLabel(AppColors colors, AppLocalizations l10n) {
    switch (_state) {
      case _RecordState.idle:
        return Text(
          'Tap to ${l10n.voicemailRecord.toLowerCase()}',
          style: TextStyle(color: colors.textTertiary, fontSize: 13),
        );
      case _RecordState.recording:
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.accentDanger,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '${l10n.voicemailRecording} ${_formatDuration(_elapsed)}',
              style: TextStyle(
                color: colors.accentDanger,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        );
      case _RecordState.recorded:
        return Text(
          _formatDuration(_elapsed),
          style: TextStyle(
            color: colors.textSecondary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        );
      case _RecordState.uploading:
        return Text(
          '${l10n.voicemailUpload}...',
          style: TextStyle(color: colors.textSecondary),
        );
      case _RecordState.done:
        return const SizedBox.shrink();
    }
  }
}
