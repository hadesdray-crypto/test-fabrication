plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Numéro de version : donné par la fabrication (numéro de passage), sinon 1.
val numero = (System.getenv("NUMERO_VERSION") ?: "1").toInt()

android {
    namespace = "fr.heuressup"
    compileSdk = 35

    defaultConfig {
        applicationId = "fr.heuressup"
        minSdk = 24
        targetSdk = 35
        versionCode = numero
        versionName = "1.0.$numero"
    }

    signingConfigs {
        create("heuressup") {
            storeFile = rootProject.file("cle/heuressup.jks")
            storePassword = "heuressup2026"
            keyAlias = "heuressup"
            keyPassword = "heuressup2026"
        }
    }

    buildTypes {
        getByName("debug") { signingConfig = signingConfigs.getByName("heuressup") }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("heuressup")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
