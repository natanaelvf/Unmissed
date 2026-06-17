import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:missed_lead_recovery/l10n/generated/app_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/demo_config.dart';
import '../config/supabase_config.dart';
import '../providers/contractor_provider.dart';
import '../theme/app_colors.dart';

/// Voicemail settings screen — configure per-language voicemail greetings.
/// Accessible from Settings > Voicemail Greetings.
class VoicemailSettingsScreen extends ConsumerStatefulWidget {
  const VoicemailSettingsScreen({super.key});

  @override
  ConsumerState<VoicemailSettingsScreen> createState() =>
      _VoicemailSettingsScreenState();
}

class _VoicemailSettingsScreenState
    extends ConsumerState<VoicemailSettingsScreen> {
  static const _locales = ['fi', 'en', 'pt'];
  bool _isSaving = false;

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

  String _localeFlag(String locale) {
    switch (locale) {
      case 'fi':
        return '🇫🇮';
      case 'en':
        return '🇬🇧';
      case 'pt':
        return '🇵🇹';
      default:
        return '🌐';
    }
  }

  /// Get the voicemail type for a locale from current config
  String _getType(Map<String, Map<String, String>> config, String locale) {
    return config[locale]?['type'] ?? 'default';
  }

  /// Update voicemail config for a locale (preset or default)
  Future<void> _updateConfig(String locale, String type,
      {String? presetId}) async {
    setState(() => _isSaving = true);
    try {
      final contractorAsync = ref.read(contractorProvider);
      final c = contractorAsync.valueOrNull;
      if (c == null) return;

      final updatedConfig =
          Map<String, Map<String, String>>.from(c.voicemailConfig);

      if (type == 'preset' && presetId != null) {
        updatedConfig[locale] = {'type': 'preset', 'preset_id': presetId};
      } else if (type == 'default') {
        updatedConfig[locale] = {'type': 'default'};
      }

      await ref.read(contractorProvider.notifier).updateSettings({
        'voicemail_config': updatedConfig,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                AppLocalizations.of(context)!.voicemailSaved),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  /// Delete custom recording for a locale
  Future<void> _deleteCustom(String locale) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.voicemailDelete),
        content: Text(l10n.voicemailDeleteConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.voicemailDelete,
                style: const TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isSaving = true);
    try {
      // In demo mode, skip actual storage deletion.
      if (!isDemo) {
        final contractorId = supabase.auth.currentUser?.id;
        if (contractorId == null) return;

        // Try to remove the file (it may not exist if it was a preset)
        await supabase.storage
            .from('voicemails')
            .remove(['$contractorId/$locale.mp3']);
      }

      // Revert config to default
      await _updateConfig(locale, 'default');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = AppColors.of(context);
    final contractorAsync = ref.watch(contractorProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.voicemailTitle),
        backgroundColor: colors.bgBase,
        foregroundColor: colors.textPrimary,
        elevation: 0,
      ),
      backgroundColor: colors.bgBase,
      body: contractorAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (contractor) {
          if (contractor == null) {
            return const Center(child: Text('No contractor data'));
          }

          final config = contractor.voicemailConfig;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Subtitle
              Text(
                l10n.voicemailSubtitle,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colors.textSecondary,
                    ),
              ),
              const SizedBox(height: 20),

              // One card per locale
              for (final locale in _locales) ...[
                _VoicemailLocaleCard(
                  locale: locale,
                  localeName: _localeName(locale, l10n),
                  flag: _localeFlag(locale),
                  currentType: _getType(config, locale),
                  presetId: config[locale]?['preset_id'],
                  isSaving: _isSaving,
                  onSelectDefault: () => _updateConfig(locale, 'default'),
                  onSelectPreset: (presetId) =>
                      _updateConfig(locale, 'preset', presetId: presetId),
                  onDeleteCustom: () => _deleteCustom(locale),
                ),
                const SizedBox(height: 12),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Card for a single locale's voicemail configuration.
class _VoicemailLocaleCard extends StatelessWidget {
  final String locale;
  final String localeName;
  final String flag;
  final String currentType;
  final String? presetId;
  final bool isSaving;
  final VoidCallback onSelectDefault;
  final void Function(String presetId) onSelectPreset;
  final VoidCallback onDeleteCustom;

  const _VoicemailLocaleCard({
    required this.locale,
    required this.localeName,
    required this.flag,
    required this.currentType,
    this.presetId,
    required this.isSaving,
    required this.onSelectDefault,
    required this.onSelectPreset,
    required this.onDeleteCustom,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return Container(
      decoration: BoxDecoration(
        color: colors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with flag and locale name
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Row(
              children: [
                Text(flag, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 10),
                Text(
                  localeName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const Spacer(),
                // Current type badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: currentType == 'custom'
                        ? colors.accentPrimary.withValues(alpha: 0.12)
                        : currentType == 'preset'
                            ? colors.urgencyHigh.withValues(alpha: 0.12)
                            : colors.textTertiary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    currentType == 'custom'
                        ? l10n.voicemailTypeCustom
                        : currentType == 'preset'
                            ? l10n.voicemailTypePreset
                            : l10n.voicemailTypeDefault,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: currentType == 'custom'
                          ? colors.accentPrimary
                          : currentType == 'preset'
                              ? colors.urgencyHigh
                              : colors.textTertiary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Type selector
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                // Default option
                _TypeOption(
                  label: l10n.voicemailTypeDefault,
                  icon: Icons.auto_awesome,
                  isSelected: currentType == 'default',
                  isEnabled: !isSaving,
                  onTap: onSelectDefault,
                ),
                const SizedBox(height: 6),
                // Preset option
                _TypeOption(
                  label: l10n.voicemailTypePreset,
                  icon: Icons.library_music_rounded,
                  isSelected: currentType == 'preset',
                  isEnabled: !isSaving,
                  onTap: () => onSelectPreset('voicemail_$locale'),
                ),
                const SizedBox(height: 6),
                // Custom option (shows delete if already custom)
                if (currentType == 'custom')
                  _TypeOption(
                    label: l10n.voicemailTypeCustom,
                    icon: Icons.mic,
                    isSelected: true,
                    isEnabled: !isSaving,
                    trailing: IconButton(
                      icon: Icon(Icons.delete_outline,
                          color: colors.accentDanger, size: 20),
                      onPressed: isSaving ? null : onDeleteCustom,
                      tooltip: l10n.voicemailDelete,
                    ),
                    onTap: () {},
                  )
                else
                  _TypeOption(
                    label: l10n.voicemailTypeCustom,
                    icon: Icons.mic,
                    isSelected: false,
                    isEnabled: false, // Requires recording — can't tap to select
                    subtitle: l10n.voicemailRecord,
                    onTap: () {},
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Radio-style option for voicemail type selection.
class _TypeOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final bool isEnabled;
  final VoidCallback onTap;
  final Widget? trailing;
  final String? subtitle;

  const _TypeOption({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.isEnabled,
    required this.onTap,
    this.trailing,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Opacity(
      opacity: isEnabled ? 1.0 : 0.5,
      child: InkWell(
        onTap: isEnabled ? onTap : null,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? colors.accentPrimary.withValues(alpha: 0.08)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color:
                  isSelected ? colors.accentPrimary : colors.borderSubtle,
              width: isSelected ? 1.5 : 1.0,
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 20,
                color:
                    isSelected ? colors.accentPrimary : colors.textTertiary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.w500,
                        color: isSelected
                            ? colors.accentPrimary
                            : colors.textPrimary,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: TextStyle(
                          fontSize: 11,
                          color: colors.textTertiary,
                        ),
                      ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
              if (isSelected && trailing == null)
                Icon(Icons.check_circle, size: 20, color: colors.accentPrimary),
            ],
          ),
        ),
      ),
    );
  }
}
