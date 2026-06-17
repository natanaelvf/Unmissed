/// Demo mode — compile-time flag.
///
/// Build with demo mode:
///   flutter run --dart-define=DEMO=true
///
/// The flag is baked in at compile time. When `isDemo` is true, the app
/// runs entirely on in-memory mock data — no Supabase, Firebase, Sentry,
/// or network calls.
const bool isDemo = bool.fromEnvironment('DEMO', defaultValue: false);
