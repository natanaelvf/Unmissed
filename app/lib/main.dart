import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'app.dart';
import 'config/demo_config.dart';
import 'providers/demo_providers.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Demo mode — skip all backend services ──────────────────────────
  if (isDemo) {
    debugPrint('🟡 DEMO MODE — running with mock data, no backend services');
    runApp(
      ProviderScope(
        overrides: buildDemoOverrides(),
        child: const App(),
      ),
    );
    return;
  }

  // ── Production / dev — full initialization ─────────────────────────

  // Load environment config.
  // Pass --dart-define=ENV=prod for production builds;
  // defaults to 'dev' for local development.
  const env = String.fromEnvironment('ENV', defaultValue: 'dev');
  await dotenv.load(fileName: '.env.$env');

  // Initialize Firebase
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('[firebase] Firebase initialization skipped/failed: $e');
  }

  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );

  // Initialize push notifications
  await NotificationService().init();

  await SentryFlutter.init(
    (options) {
      options.dsn = dotenv.env['SENTRY_DSN'] ?? '';
      options.tracesSampleRate = 1.0;
    },
    appRunner: () => runApp(SentryWidget(child: const ProviderScope(child: App()))),
  );
}
