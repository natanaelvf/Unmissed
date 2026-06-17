import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show User;
import '../data/mock_data.dart';
import '../models/activity_event.dart';
import '../models/contractor.dart';
import '../models/lead.dart';
import '../models/message.dart';
import '../providers/auth_provider.dart';
import '../providers/contractor_provider.dart';
import '../providers/leads_provider.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Demo state — controls whether demo is "logged in" or showing login/onboarding
// ═══════════════════════════════════════════════════════════════════════════

/// Controls the demo session state. Allows the Settings "Reset to Login"
/// toggle to simulate signing out, so you can test the full flow.
class DemoSessionNotifier extends ChangeNotifier {
  bool _isLoggedIn = true;
  bool _hasCompletedOnboarding = true;

  bool get isLoggedIn => _isLoggedIn;
  bool get hasCompletedOnboarding => _hasCompletedOnboarding;

  /// Simulate "signing out" — resets to login screen.
  void resetToLogin() {
    _isLoggedIn = false;
    _hasCompletedOnboarding = false;
    notifyListeners();
  }

  /// Simulate "signing in" — called from the demo login screen.
  void signIn() {
    _isLoggedIn = true;
    _hasCompletedOnboarding = false;
    notifyListeners();
  }

  /// Simulate completing onboarding.
  void completeOnboarding() {
    _hasCompletedOnboarding = true;
    notifyListeners();
  }

  /// Skip straight to dashboard (restores default demo state).
  void skipToDashboard() {
    _isLoggedIn = true;
    _hasCompletedOnboarding = true;
    notifyListeners();
  }
}

final demoSessionProvider = ChangeNotifierProvider<DemoSessionNotifier>((ref) {
  return DemoSessionNotifier();
});

// ═══════════════════════════════════════════════════════════════════════════
// Demo Auth — wraps AuthNotifier API without touching Supabase
// ═══════════════════════════════════════════════════════════════════════════

class _DemoAuthNotifier extends ChangeNotifier implements AuthNotifier {
  final Ref _ref;
  AuthState _state;

  _DemoAuthNotifier(this._ref)
      : _state = const AuthState(isAuthenticated: true) {
    _ref.listen(demoSessionProvider, (_, session) {
      _state = AuthState(isAuthenticated: session.isLoggedIn);
      notifyListeners();
    });
  }

  @override
  AuthState get state => _state;
  @override
  bool get isAuthenticated => _state.isAuthenticated;
  @override
  bool get isLoading => _state.isLoading;
  @override
  String? get errorMessage => _state.errorMessage;
  @override
  User? get user => null;

  @override
  Future<void> signInWithEmail(String email, String password) async {
    _state = _state.copyWith(isLoading: true, clearError: true);
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 800));
    _ref.read(demoSessionProvider).signIn();
    _state = const AuthState(isAuthenticated: true);
    notifyListeners();
  }

  @override
  Future<void> signUpWithEmail(String email, String password) async {
    return signInWithEmail(email, password);
  }

  @override
  Future<void> signInWithGoogle() async {
    return signInWithEmail('demo@unmissed.fi', 'demo');
  }

  @override
  Future<void> resetPassword(String email) async {
    _state = _state.copyWith(
      isLoading: false,
      errorMessage: 'Password reset link sent — check your email. (demo)',
    );
    notifyListeners();
  }

  @override
  Future<void> signOut() async {
    _ref.read(demoSessionProvider).resetToLogin();
    _state = const AuthState();
    notifyListeners();
  }

  @override
  void clearError() {
    _state = _state.copyWith(clearError: true);
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Contractor — returns mockContractor, in-memory mutations
// ═══════════════════════════════════════════════════════════════════════════

class _DemoContractorNotifier extends ContractorNotifier {
  @override
  Future<Contractor> build() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return mockContractor;
  }

  @override
  Future<void> updateSettings(Map<String, dynamic> fields) async {
    final current = state.valueOrNull ?? mockContractor;
    state = AsyncData(current.copyWith(
      businessName: fields['business_name'] as String? ?? current.businessName,
      contactName: fields['contact_name'] as String? ?? current.contactName,
      contactEmail: fields['contact_email'] as String? ?? current.contactEmail,
      contactPhone: fields['contact_phone'] as String? ?? current.contactPhone,
      calendlyUrl: fields['calendly_url'] as String? ?? current.calendlyUrl,
      workingDays:
          (fields['working_days'] as List<dynamic>?)?.cast<int>() ?? current.workingDays,
      workingHoursStart:
          fields['working_hours_start'] as String? ?? current.workingHoursStart,
      workingHoursEnd:
          fields['working_hours_end'] as String? ?? current.workingHoursEnd,
      urgencyThresholdUrgentMin: fields['urgency_threshold_urgent_min'] as int? ??
          current.urgencyThresholdUrgentMin,
      urgencyThresholdNormalMin: fields['urgency_threshold_normal_min'] as int? ??
          current.urgencyThresholdNormalMin,
      defaultJobValue:
          (fields['default_job_value'] as num?)?.toDouble() ?? current.defaultJobValue,
      notificationPreferences:
          (fields['notification_preferences'] as Map<String, dynamic>?)?.map(
                (k, v) => MapEntry(k, v as bool),
              ) ??
              current.notificationPreferences,
      voicemailConfig:
          (fields['voicemail_config'] as Map<String, Map<String, String>>?) ??
              current.voicemailConfig,
      updatedAt: DateTime.now(),
    ));
  }

  @override
  Future<void> saveOnboarding({
    required String businessName,
    required String contactName,
    required String contactEmail,
    required String contactPhone,
    required String twilioPhoneNumber,
    required String numberSetupType,
    String? tradeType,
    String? calendlyUrl,
    required List<int> workingDays,
    required String workingHoursStart,
    required String workingHoursEnd,
    required int urgencyThresholdUrgentMin,
    required int urgencyThresholdNormalMin,
    required double defaultJobValue,
  }) async {
    await Future.delayed(const Duration(milliseconds: 500));

    state = AsyncData(mockContractor.copyWith(
      businessName: businessName,
      contactName: contactName,
      contactEmail: contactEmail,
      contactPhone: contactPhone,
      twilioPhoneNumber: twilioPhoneNumber,
      numberSetupType: numberSetupType,
      tradeType: tradeType,
      calendlyUrl: calendlyUrl,
      workingDays: workingDays,
      workingHoursStart: workingHoursStart,
      workingHoursEnd: workingHoursEnd,
      urgencyThresholdUrgentMin: urgencyThresholdUrgentMin,
      urgencyThresholdNormalMin: urgencyThresholdNormalMin,
      defaultJobValue: defaultJobValue,
      updatedAt: DateTime.now(),
    ));

    ref.read(demoSessionProvider).completeOnboarding();
  }

  @override
  Future<void> refresh() async {}
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Leads — in-memory, supports all mutations
// ═══════════════════════════════════════════════════════════════════════════

/// In-memory store for mock messages (mutable copy).
final _demoMessages = Map<String, List<Message>>.from(
  mockMessages.map((k, v) => MapEntry(k, List<Message>.from(v))),
);

/// In-memory store for mock job costs per lead.
final Map<String, List<JobCost>> _demoCosts = {};

class _DemoLeadsNotifier extends LeadsNotifier {
  @override
  Future<List<Lead>> build() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return List<Lead>.from(mockLeads);
  }

  @override
  Future<void> markComplete(String leadId) async {
    final currentLeads = state.valueOrNull ?? [];
    state = AsyncData(currentLeads.map((l) {
      if (l.id == leadId) {
        return l.copyWith(status: LeadStatus.completed, updatedAt: DateTime.now());
      }
      return l;
    }).toList());

    final lead = currentLeads.firstWhere((l) => l.id == leadId);
    ref.read(activityNotifierProvider).addEvent(ActivityEvent(
      type: ActivityType.leadCompleted,
      description: 'Lead completed: ${lead.displayName}',
      timestamp: DateTime.now(),
      leadId: leadId,
    ));
  }

  @override
  Future<void> updateEstimatedValue(String leadId, double newValue) async {
    final currentLeads = state.valueOrNull ?? [];
    final oldLead = currentLeads.firstWhere((l) => l.id == leadId);

    state = AsyncData(currentLeads.map((l) {
      if (l.id == leadId) {
        return l.copyWith(estimatedValue: newValue, updatedAt: DateTime.now());
      }
      return l;
    }).toList());

    ref.read(activityNotifierProvider).addEvent(ActivityEvent(
      type: ActivityType.revenueUpdated,
      description: oldLead.estimatedValue != null
          ? 'Revenue updated: ${oldLead.displayName} — €${oldLead.estimatedValue!.toInt()} → €${newValue.toInt()}'
          : 'Revenue set: ${oldLead.displayName} — €${newValue.toInt()}',
      timestamp: DateTime.now(),
      leadId: leadId,
    ));
  }

  @override
  Future<void> addCost(String leadId, String description, double amount) async {
    final cost = JobCost(
      id: 'demo-cost-${DateTime.now().millisecondsSinceEpoch}',
      description: description,
      amount: amount,
      createdAt: DateTime.now(),
    );

    _demoCosts.putIfAbsent(leadId, () => []);
    _demoCosts[leadId]!.insert(0, cost);

    final currentLeads = state.valueOrNull ?? [];
    state = AsyncData(currentLeads.map((l) {
      if (l.id == leadId) {
        return l.copyWith(
          costs: List.from(_demoCosts[leadId] ?? []),
          updatedAt: DateTime.now(),
        );
      }
      return l;
    }).toList());

    final lead = currentLeads.firstWhere((l) => l.id == leadId);
    ref.read(activityNotifierProvider).addEvent(ActivityEvent(
      type: ActivityType.costAdded,
      description:
          'Cost added: ${lead.displayName} — €${amount.toInt()} ($description)',
      timestamp: DateTime.now(),
      leadId: leadId,
    ));
  }

  @override
  Future<void> addLead({
    required String phone,
    String? name,
    String? description,
    String urgency = 'unknown',
    double? estimatedValue,
  }) async {
    final newLead = Lead(
      id: 'demo-lead-${DateTime.now().millisecondsSinceEpoch}',
      contractorId: mockContractor.id,
      callerPhone: phone,
      callerName: name,
      issueDescription: description,
      urgency: Urgency.fromString(urgency),
      status: LeadStatus.missed,
      estimatedValue: estimatedValue,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    final currentLeads = state.valueOrNull ?? [];
    state = AsyncData([newLead, ...currentLeads]);
  }

  @override
  Future<void> refresh() async {}

  @override
  Future<void> updateNotes(String leadId, String notes) async {
    final currentLeads = state.valueOrNull ?? [];
    state = AsyncData(currentLeads.map((l) {
      if (l.id == leadId) {
        return l.copyWith(notes: notes, updatedAt: DateTime.now());
      }
      return l;
    }).toList());
  }

  @override
  Future<void> updateRating(String leadId, int rating) async {
    final currentLeads = state.valueOrNull ?? [];
    state = AsyncData(currentLeads.map((l) {
      if (l.id == leadId) {
        return l.copyWith(satisfactionScore: rating, updatedAt: DateTime.now());
      }
      return l;
    }).toList());

    final lead = currentLeads.firstWhere((l) => l.id == leadId);
    ref.read(activityNotifierProvider).addEvent(ActivityEvent(
      type: ActivityType.satisfactionReceived,
      description:
          'Lead rated: ${lead.displayName} — ${'★' * rating}${'☆' * (5 - rating)}',
      timestamp: DateTime.now(),
      leadId: leadId,
    ));
  }

  @override
  Future<void> deleteLeadGdpr(String leadId) async {
    final currentLeads = state.valueOrNull ?? [];
    state = AsyncData(currentLeads.where((l) => l.id != leadId).toList());
    _demoMessages.remove(leadId);
    _demoCosts.remove(leadId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Demo Activity — pre-seeded with mock events
// ═══════════════════════════════════════════════════════════════════════════

class _DemoActivityNotifier extends ActivityNotifier {
  _DemoActivityNotifier() {
    for (final event in generateMockActivityEvents().reversed) {
      addEvent(event);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider overrides list — used in main.dart
// ═══════════════════════════════════════════════════════════════════════════

/// Returns the list of provider overrides for demo mode.
/// Call this from main.dart to configure ProviderScope.
List<Override> buildDemoOverrides() {
  return [
    // Auth — override entire provider to avoid AuthNotifier constructor
    // touching Supabase (which isn't initialized in demo mode).
    authProvider.overrideWith((ref) => _DemoAuthNotifier(ref)),

    // Contractor — demo subclass overrides build() + mutation methods
    contractorProvider.overrideWith(() => _DemoContractorNotifier()),

    // Onboarding complete — derived from demo session
    isOnboardingCompleteProvider.overrideWith((ref) {
      return ref.watch(demoSessionProvider).hasCompletedOnboarding;
    }),

    // Contractor loaded — always true in demo (no async fetch to wait for)
    isContractorLoadedProvider.overrideWith((ref) => true),

    // Leads — demo subclass overrides build() + mutation methods
    leadsProvider.overrideWith(() => _DemoLeadsNotifier()),

    // Activity — pre-seeded
    activityNotifierProvider.overrideWith((ref) => _DemoActivityNotifier()),

    // Messages — from mock data map
    messagesProvider.overrideWith((ref, leadId) async {
      return _demoMessages[leadId] ?? [];
    }),

    // Job costs — from in-memory store
    jobCostsProvider.overrideWith((ref, leadId) async {
      return _demoCosts[leadId] ?? [];
    }),
  ];
}
