#!/bin/bash

# ================================================
# AD - 20260814 - Script di build per FireTrack
# apk signed con apksigner
# Uso: ./build.sh [debug|release|clean] [-destroy]
# ================================================

set -euo pipefail

# ================================================
# CONFIGURAZIONE
# ================================================

PROJECT_DIR="$HOME/coding/FireTrack"
BUILD_TYPE="${1:-debug}"
DESTROY_MODE=false

# Controlla se il parametro -destroy è presente
for arg in "$@"; do
    if [ "$arg" = "-destroy" ]; then
        DESTROY_MODE=true
        break
    fi
done

KEYSTORE_PATH="$HOME/.android/keys/firetrack-production.jks"
KEY_ALIAS="${KEY_ALIAS:-firetrack}"
KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${KEY_PASSWORD:-}"

ICONA_SOURCE="$HOME/Pictures/icon.png"

# ================================================
# LOGGING
# ================================================

LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d-%H_%M")
LOG_FILE="$LOG_DIR/build_${TIMESTAMP}.log"
ERROR_FILE="$LOG_DIR/errors_${TIMESTAMP}.log"
SUMMARY_FILE="$LOG_DIR/summary_${TIMESTAMP}.log"

init_logging() {
    mkdir -p "$LOG_DIR"
    exec 3>&1 4>&2
    exec > >(tee -a "$LOG_FILE") 2>&1
    echo "[$(date +"%Y%m%d-%H:%M:%S")] Build started (${BUILD_TYPE})"
}

log() {
    echo "[$(date +"%Y%m%d-%H:%M:%S")] $*"
}

log_error() {
    echo "[$(date +"%Y%m%d-%H:%M:%S")] ERROR: $*" >&2
}

log_summary() {
    echo "[$(date +"%Y%m%d-%H:%M:%S")] $*" >> "$SUMMARY_FILE"
}

cleanup_logging() {
    exec 1>&3 2>&4
}

# ================================================
# FUNZIONI
# ================================================

run() {
    local cmd="$*"
    local output
    output=$(mktemp)

    echo -n "[$(date +"%Y%m%d-%H:%M:%S")] ${STEP_NAME}: > ${cmd} ... "

    if eval "$cmd" >"$output" 2>&1; then
        echo "OK"
    else
        echo "KO"
        cat "$output" >> "$ERROR_FILE"
        rm -f "$output"
        exit 1
    fi

    rm -f "$output"
}

# ================================================
# RISORSE ANDROID
# ================================================

fix_android_resources() {

    cd "$PROJECT_DIR/android/app/src/main/res"

    rm -rf drawable-* mipmap-* values/colors.xml

    mkdir -p \
        drawable \
        drawable-land-mdpi \
        mipmap-mdpi \
        mipmap-hdpi \
        mipmap-xhdpi \
        mipmap-xxhdpi \
        mipmap-xxxhdpi

    if [ -f "$ICONA_SOURCE" ]; then

        for dir in \
            drawable \
            drawable-land-mdpi \
            mipmap-mdpi \
            mipmap-hdpi \
            mipmap-xhdpi \
            mipmap-xxhdpi \
            mipmap-xxxhdpi
        do
            cp "$ICONA_SOURCE" "$dir/splash.png"
            cp "$ICONA_SOURCE" "$dir/ic_launcher.png"
            cp "$ICONA_SOURCE" "$dir/ic_launcher_round.png"
        done

    else

        cat > values/colors.xml <<EOF
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="black">#000000</color>
    <color name="white">#FFFFFF</color>
    <color name="blue">#2196F3</color>
</resources>
EOF

        cat > drawable/splash.xml <<EOF
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white"/>
</layer-list>
EOF

        cp drawable/splash.xml drawable-land-mdpi/

        for dir in \
            mipmap-mdpi \
            mipmap-hdpi \
            mipmap-xhdpi \
            mipmap-xxhdpi \
            mipmap-xxxhdpi
        do
            cat > "$dir/ic_launcher.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/blue"/>
    <foreground android:drawable="@color/white"/>
</adaptive-icon>
EOF

            cp "$dir/ic_launcher.xml" "$dir/ic_launcher_round.xml"
        done

    fi

    cd "$PROJECT_DIR"
}

# ================================================
# MAIN
# ================================================

init_logging

STEP_NAME="Unzip"
log "Extracting project"
run unzip -qq -o /home/fire/coding/firetrack.zip -d "$PROJECT_DIR"

cd "$PROJECT_DIR"

if [ "$BUILD_TYPE" = "clean" ]; then

    STEP_NAME="Clean"
    log "Cleaning build artifacts"
    run rm -rf \
        node_modules \
        dist \
        android/.gradle \
        android/app/build \
        android/build

    log_summary "Clean completed"
    cleanup_logging
    exit 0
fi

if [ "$BUILD_TYPE" = "release" ]; then

    [ -f "$KEYSTORE_PATH" ] || {
        echo "KO"
        log_error "Keystore non trovato: $KEYSTORE_PATH"
        exit 1
    }

    [ -n "$KEYSTORE_PASSWORD" ] || {
        read -rsp "Password keystore: " KEYSTORE_PASSWORD
        echo
    }

    [ -n "$KEY_PASSWORD" ] || {
        read -rsp "Password chiave: " KEY_PASSWORD
        echo
    }
fi

STEP_NAME="Resources"
log "Fixing Android resources"
fix_android_resources
echo "OK"

STEP_NAME="NPM"
log "Installing dependencies"
run npm install

STEP_NAME="Build"
log "Building application"
run npm run build

STEP_NAME="Capacitor"
log "Syncing Capacitor"
run npx cap sync android

cd android

if [ "$DESTROY_MODE" = true ]; then
    STEP_NAME="Destroy"
    log "Destroy mode: recreating gradle-wrapper.jar"
    run rm -f gradle/wrapper/gradle-wrapper.jar
    run wget -q \
        https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar \
        -P gradle/wrapper
else
    STEP_NAME="Gradle"
    log "Normal mode: keeping gradle-wrapper.jar"
fi

run chmod +x gradlew
run sed -i '/android.enableAapt2/d' gradle.properties

if [ "$BUILD_TYPE" = "debug" ]; then

    STEP_NAME="Gradle"
    log "Building debug APK"
    run ./gradlew clean assembleDebug
    run cp app/build/outputs/apk/debug/app-debug.apk \
        "$PROJECT_DIR/FireTrack-debug.apk"
    
    log_summary "Debug APK: $PROJECT_DIR/FireTrack-debug.apk"

elif [ "$BUILD_TYPE" = "release" ]; then

    STEP_NAME="Gradle"
    log "Building release APK"
    echo "android.lint.checkReleaseBuilds=false" >> gradle.properties
    echo "android.lint.abortOnError=false" >> gradle.properties

    run ./gradlew clean assembleRelease

    APK_UNSIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"
    APK_ALIGNED="$PROJECT_DIR/FireTrack-aligned.apk"
    APK_FINAL="$PROJECT_DIR/FireTrack-production.apk"

    STEP_NAME="Zipalign"
    log "Aligning APK"
    run zipalign -f -p 4 \
        "$APK_UNSIGNED" \
        "$APK_ALIGNED"

    STEP_NAME="Apksigner"
    log "Signing APK"
    run apksigner sign \
        --ks "$KEYSTORE_PATH" \
        --ks-pass pass:"$KEYSTORE_PASSWORD" \
        --key-pass pass:"$KEY_PASSWORD" \
        --ks-key-alias "$KEY_ALIAS" \
        --out "$APK_FINAL" \
        "$APK_ALIGNED"

    STEP_NAME="Verify"
    log "Verifying signature"
    run apksigner verify --verbose "$APK_FINAL"

    run rm -f "$APK_ALIGNED"
    
    log_summary "Production APK: $APK_FINAL"

else

    echo "KO"
    log_error "Uso: ./build.sh [debug|release|clean] [-destroy]"
    exit 1

fi

log "Build completed"
log_summary "Build completed successfully (${BUILD_TYPE})"
cleanup_logging
