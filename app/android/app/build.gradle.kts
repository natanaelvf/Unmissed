import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
    id("com.google.firebase.appdistribution")
}

// Load keystore properties if available (for release signing)
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("app/key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.unmissed.leads"
    compileSdk = 36
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "com.unmissed.leads"
        minSdk = 23
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Set the APK output filename to "Unmissed" instead of "app"
        setProperty("archivesBaseName", "Unmissed")
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }

            firebaseAppDistribution {
                artifactType = "APK"
                testers = "natanaelvf@gmail.com"
                serviceCredentialsFile = rootProject.file("unmissed-project-firebase-adminsdk.json").absolutePath
                releaseNotes = """
🚀 Unmissed — New Build Available!

Hey! A fresh build of Unmissed is ready for you to test.

What's Unmissed?
Your AI-powered missed lead recovery assistant. Never let a lead slip through the cracks again.

📲 Install this build and let us know what you think.
💬 Reply to this email or message the team directly with any feedback.

— The Unmissed Team
                """.trimIndent()
            }
        }
    }
}

flutter {
    source = "../.."
}
