import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/onboarding_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/trade_type_picker.dart';

/// Step 1 (merged): About You & Your Business — business name, trade type,
/// contact name, email, and phone.
class StepBusinessInfo extends ConsumerStatefulWidget {
  const StepBusinessInfo({super.key});

  @override
  ConsumerState<StepBusinessInfo> createState() => _StepBusinessInfoState();
}

class _StepBusinessInfoState extends ConsumerState<StepBusinessInfo> {
  late TextEditingController _businessNameCtrl;
  late TextEditingController _nameCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _phoneCtrl;

  @override
  void initState() {
    super.initState();
    final ob = ref.read(onboardingProvider);
    _businessNameCtrl = TextEditingController(text: ob.businessName);
    _nameCtrl = TextEditingController(text: ob.contactName);
    _emailCtrl = TextEditingController(text: ob.contactEmail);
    _phoneCtrl = TextEditingController(text: ob.contactPhone);
  }

  @override
  void dispose() {
    _businessNameCtrl.dispose();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _sync() {
    final ob = ref.read(onboardingProvider);
    ob.businessName = _businessNameCtrl.text;
    ob.contactName = _nameCtrl.text;
    ob.contactEmail = _emailCtrl.text;
    ob.contactPhone = _phoneCtrl.text;
    // ignore: invalid_use_of_protected_member, invalid_use_of_visible_for_testing_member
    ob.notifyListeners();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final onboarding = ref.watch(onboardingProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          const Text('👋', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          Text(
            'About you & your business',
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 6),
          Text(
            'We\'ll use this to personalize your recovery experience.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textSecondary,
                ),
          ),

          const SizedBox(height: 28),

          // Business name
          Text(
            'BUSINESS NAME',
            style: Theme.of(context).textTheme.labelSmall,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _businessNameCtrl,
            onChanged: (_) => _sync(),
            decoration: const InputDecoration(
              hintText: 'e.g. Virtanen LVI Oy',
            ),
          ),

          const SizedBox(height: 24),

          // Trade type
          Text(
            'YOUR TRADE',
            style: Theme.of(context).textTheme.labelSmall,
          ),
          const SizedBox(height: 12),
          TradeTypePicker(
            selected: onboarding.tradeType,
            onSelected: (value) {
              onboarding.tradeType = value;
              // ignore: invalid_use_of_protected_member, invalid_use_of_visible_for_testing_member
              onboarding.notifyListeners();
            },
          ),

          const SizedBox(height: 28),

          // Divider between business and personal info
          Row(
            children: [
              Expanded(child: Divider(color: colors.borderSubtle)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'YOUR DETAILS',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
              Expanded(child: Divider(color: colors.borderSubtle)),
            ],
          ),

          const SizedBox(height: 20),

          // Full name
          Text('FULL NAME', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 8),
          TextField(
            controller: _nameCtrl,
            onChanged: (_) => _sync(),
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              hintText: 'e.g. Jukka Virtanen',
              prefixIcon: Icon(Icons.person_outline, size: 20),
            ),
          ),

          const SizedBox(height: 20),

          // Email
          Text('EMAIL', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 8),
          TextField(
            controller: _emailCtrl,
            onChanged: (_) => _sync(),
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              hintText: 'e.g. jukka@virtanenlvi.fi',
              prefixIcon: Icon(Icons.email_outlined, size: 20),
            ),
          ),

          const SizedBox(height: 20),

          // Phone
          Text('PHONE NUMBER',
              style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 8),
          TextField(
            controller: _phoneCtrl,
            onChanged: (_) => _sync(),
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              hintText: 'e.g. +358 40 123 4567',
              prefixIcon: Icon(Icons.phone_outlined, size: 20),
            ),
          ),

          const SizedBox(height: 16),

          // Helper text
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.accentInfoMuted,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: colors.accentInfo.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline,
                    size: 18, color: colors.accentInfo),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'This phone number is for account contact only. '
                    'Missed call forwarding is set up in the next step.',
                    style: TextStyle(
                        fontSize: 12,
                        color: colors.accentInfo,
                        height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
