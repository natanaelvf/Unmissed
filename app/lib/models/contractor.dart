/// Parse voicemail_config JSONB from Supabase into a typed map.
/// Expected shape: { "fi": { "type": "custom", "storage_path": "..." }, ... }
Map<String, Map<String, String>> _parseVoicemailConfig(dynamic raw) {
  if (raw == null || raw is! Map) return {};
  final result = <String, Map<String, String>>{};
  for (final entry in (raw as Map<String, dynamic>).entries) {
    if (entry.value is Map) {
      result[entry.key] = (entry.value as Map<String, dynamic>).map(
        (k, v) => MapEntry(k, v?.toString() ?? ''),
      );
    }
  }
  return result;
}

class Contractor {
  final String id;
  final String businessName;
  final String contactName;
  final String contactEmail;
  final String contactPhone;
  final String twilioPhoneNumber;
  final String numberSetupType;
  // calendlyUrl removed — column kept in DB for old data but no longer used in app
  final String? tradeType;
  final double? defaultJobValue;
  final int urgencyThresholdUrgentMin;
  final int urgencyThresholdNormalMin;
  final String workingHoursStart;
  final String workingHoursEnd;
  final List<int> workingDays;
  final String? afterHoursEmergencyPolicy;
  final bool afterHoursRing;
  final String timezone;
  final String tier;
  final int monthlySMSCap;
  final int smsUsedThisMonth;
  final String? fcmToken;
  final Map<String, bool> notificationPreferences;
  final Map<String, Map<String, String>> voicemailConfig;
  // Google Calendar integration
  final bool calendarBookingEnabled;
  final DateTime? googleConnectedAt;
  final int bookingSlotDurationMin;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Contractor({
    required this.id,
    required this.businessName,
    required this.contactName,
    required this.contactEmail,
    required this.contactPhone,
    required this.twilioPhoneNumber,
    this.numberSetupType = 'forwarding',
    this.tradeType,
    this.defaultJobValue,
    this.urgencyThresholdUrgentMin = 60,
    this.urgencyThresholdNormalMin = 1440,
    this.workingHoursStart = '08:00',
    this.workingHoursEnd = '18:00',
    this.workingDays = const [1, 2, 3, 4, 5],
    this.afterHoursEmergencyPolicy,
    this.afterHoursRing = false,
    this.timezone = 'Europe/Helsinki',
    this.tier = 'starter',
    this.monthlySMSCap = 50,
    this.smsUsedThisMonth = 0,
    this.fcmToken,
    this.notificationPreferences = const {
      'missed_call': true,
      'booking_confirmed': true,
      'lead_status_change': true,
      'system_alert': true,
      'payment_notification': true,
      'custom_admin': true,
    },
    this.voicemailConfig = const {},
    this.calendarBookingEnabled = false,
    this.googleConnectedAt,
    this.bookingSlotDurationMin = 30,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Initials for avatar (e.g., "JV" from "Jukka Virtanen").
  String get initials {
    if (contactName.isEmpty) return '?';
    final parts = contactName.trim().split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2 && parts.first.isNotEmpty && parts.last.isNotEmpty) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    final name = parts.isNotEmpty ? parts.first : contactName;
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  /// SMS usage as percentage (0.0 to 1.0).
  double get smsUsagePercent =>
      monthlySMSCap > 0 ? smsUsedThisMonth / monthlySMSCap : 0;

  /// Tier display price per month.
  String get tierPrice {
    switch (tier) {
      case 'starter': return '149 €';
      case 'growth': return '249 €';
      case 'pro': return '399 €';
      default: return '149 €';
    }
  }

  factory Contractor.fromJson(Map<String, dynamic> json) {
    return Contractor(
      id: json['id'] as String,
      businessName: json['business_name'] as String,
      contactName: json['contact_name'] as String,
      contactEmail: json['contact_email'] as String,
      contactPhone: json['contact_phone'] as String,
      twilioPhoneNumber: json['twilio_phone_number'] as String,
      numberSetupType: json['number_setup_type'] as String? ?? 'forwarding',
      tradeType: json['trade_type'] as String?,
      defaultJobValue: (json['default_job_value'] as num?)?.toDouble(),
      urgencyThresholdUrgentMin: json['urgency_threshold_urgent_min'] as int? ?? 60,
      urgencyThresholdNormalMin: json['urgency_threshold_normal_min'] as int? ?? 1440,
      workingHoursStart: json['working_hours_start'] as String? ?? '08:00',
      workingHoursEnd: json['working_hours_end'] as String? ?? '18:00',
      workingDays: (json['working_days'] as List<dynamic>?)?.cast<int>() ?? [1, 2, 3, 4, 5],
      afterHoursEmergencyPolicy: json['after_hours_emergency_policy'] as String?,
      afterHoursRing: json['after_hours_ring'] as bool? ?? false,
      timezone: json['timezone'] as String? ?? 'Europe/Helsinki',
      tier: json['tier'] as String? ?? 'starter',
      monthlySMSCap: json['monthly_sms_cap'] as int? ?? 50,
      smsUsedThisMonth: json['sms_used_this_month'] as int? ?? 0,
      fcmToken: json['fcm_token'] as String?,
      notificationPreferences: (json['notification_preferences'] as Map<String, dynamic>?)?.map(
        (key, value) => MapEntry(key, value as bool? ?? true),
      ) ?? {
        'missed_call': true,
        'booking_confirmed': true,
        'lead_status_change': true,
        'system_alert': true,
        'payment_notification': true,
        'custom_admin': true,
      },
      voicemailConfig: _parseVoicemailConfig(json['voicemail_config']),
      calendarBookingEnabled: json['calendar_booking_enabled'] as bool? ?? false,
      googleConnectedAt: json['google_connected_at'] != null
          ? DateTime.parse(json['google_connected_at'] as String)
          : null,
      bookingSlotDurationMin: json['booking_slot_duration_min'] as int? ?? 30,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'business_name': businessName,
      'contact_name': contactName,
      'contact_email': contactEmail,
      'contact_phone': contactPhone,
      'twilio_phone_number': twilioPhoneNumber,
      'number_setup_type': numberSetupType,
      'trade_type': tradeType,
      'default_job_value': defaultJobValue,
      'urgency_threshold_urgent_min': urgencyThresholdUrgentMin,
      'urgency_threshold_normal_min': urgencyThresholdNormalMin,
      'working_hours_start': workingHoursStart,
      'working_hours_end': workingHoursEnd,
      'working_days': workingDays,
      'after_hours_emergency_policy': afterHoursEmergencyPolicy,
      'after_hours_ring': afterHoursRing,
      'timezone': timezone,
      'tier': tier,
      'monthly_sms_cap': monthlySMSCap,
      'sms_used_this_month': smsUsedThisMonth,
      'fcm_token': fcmToken,
      'notification_preferences': notificationPreferences,
      'voicemail_config': voicemailConfig,
      'calendar_booking_enabled': calendarBookingEnabled,
      'google_connected_at': googleConnectedAt?.toIso8601String(),
      'booking_slot_duration_min': bookingSlotDurationMin,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Contractor copyWith({
    String? id,
    String? businessName,
    String? contactName,
    String? contactEmail,
    String? contactPhone,
    String? twilioPhoneNumber,
    String? numberSetupType,
    String? tradeType,
    double? defaultJobValue,
    int? urgencyThresholdUrgentMin,
    int? urgencyThresholdNormalMin,
    String? workingHoursStart,
    String? workingHoursEnd,
    List<int>? workingDays,
    String? afterHoursEmergencyPolicy,
    bool? afterHoursRing,
    String? timezone,
    String? tier,
    int? monthlySMSCap,
    int? smsUsedThisMonth,
    String? fcmToken,
    Map<String, bool>? notificationPreferences,
    Map<String, Map<String, String>>? voicemailConfig,
    bool? calendarBookingEnabled,
    DateTime? googleConnectedAt,
    int? bookingSlotDurationMin,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Contractor(
      id: id ?? this.id,
      businessName: businessName ?? this.businessName,
      contactName: contactName ?? this.contactName,
      contactEmail: contactEmail ?? this.contactEmail,
      contactPhone: contactPhone ?? this.contactPhone,
      twilioPhoneNumber: twilioPhoneNumber ?? this.twilioPhoneNumber,
      numberSetupType: numberSetupType ?? this.numberSetupType,
      tradeType: tradeType ?? this.tradeType,
      defaultJobValue: defaultJobValue ?? this.defaultJobValue,
      urgencyThresholdUrgentMin: urgencyThresholdUrgentMin ?? this.urgencyThresholdUrgentMin,
      urgencyThresholdNormalMin: urgencyThresholdNormalMin ?? this.urgencyThresholdNormalMin,
      workingHoursStart: workingHoursStart ?? this.workingHoursStart,
      workingHoursEnd: workingHoursEnd ?? this.workingHoursEnd,
      workingDays: workingDays ?? this.workingDays,
      afterHoursEmergencyPolicy: afterHoursEmergencyPolicy ?? this.afterHoursEmergencyPolicy,
      afterHoursRing: afterHoursRing ?? this.afterHoursRing,
      timezone: timezone ?? this.timezone,
      tier: tier ?? this.tier,
      monthlySMSCap: monthlySMSCap ?? this.monthlySMSCap,
      smsUsedThisMonth: smsUsedThisMonth ?? this.smsUsedThisMonth,
      fcmToken: fcmToken ?? this.fcmToken,
      notificationPreferences: notificationPreferences ?? this.notificationPreferences,
      voicemailConfig: voicemailConfig ?? this.voicemailConfig,
      calendarBookingEnabled: calendarBookingEnabled ?? this.calendarBookingEnabled,
      googleConnectedAt: googleConnectedAt ?? this.googleConnectedAt,
      bookingSlotDurationMin: bookingSlotDurationMin ?? this.bookingSlotDurationMin,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
