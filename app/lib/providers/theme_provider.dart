import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme preference — system (follows device), dark, or light.
enum ThemePreference { system, dark, light }

/// Converts ThemePreference to Flutter's ThemeMode.
ThemeMode themeModeFromPreference(ThemePreference pref) {
  switch (pref) {
    case ThemePreference.system:
      return ThemeMode.system;
    case ThemePreference.dark:
      return ThemeMode.dark;
    case ThemePreference.light:
      return ThemeMode.light;
  }
}

/// Theme preference provider — persisted to SharedPreferences.
/// Defaults to system (follow device setting).
final themePreferenceProvider =
    StateNotifierProvider<ThemeNotifier, ThemePreference>((ref) {
  return ThemeNotifier();
});

class ThemeNotifier extends StateNotifier<ThemePreference> {
  static const _key = 'theme_preference';

  ThemeNotifier() : super(ThemePreference.system) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_key);
    if (value != null) {
      state = ThemePreference.values.firstWhere(
        (e) => e.name == value,
        orElse: () => ThemePreference.system,
      );
    }
  }

  Future<void> setTheme(ThemePreference pref) async {
    state = pref;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, pref.name);
  }
}
