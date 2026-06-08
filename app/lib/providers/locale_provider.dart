import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Supported app locales.
const supportedLocales = [
  Locale('fi'), // Finnish — primary
  Locale('en'), // English — secondary
];

/// Human-readable labels for each locale (in their own language).
const localeLabels = {
  'fi': 'Suomi',
  'en': 'English',
};

/// Locale preference provider — persisted to SharedPreferences.
/// Defaults to Finnish since Finland is the primary market.
final localeProvider = StateNotifierProvider<LocaleNotifier, Locale>((ref) {
  return LocaleNotifier();
});

class LocaleNotifier extends StateNotifier<Locale> {
  static const _key = 'app_locale';

  LocaleNotifier() : super(const Locale('fi')) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_key);
    if (code != null) {
      state = Locale(code);
    }
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, locale.languageCode);
  }
}
