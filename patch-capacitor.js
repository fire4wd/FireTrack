import fs from 'fs';
import path from 'path';

console.log('[PATCH] Starting Capacitor Android fix and SSL configuration...');

// 1. Ensure Capacitor Android build.gradle has ALL dependencies (including Cordova and WebKit)
const capacitorGradlePath = path.join(
  process.cwd(),
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'build.gradle'
);

if (fs.existsSync(capacitorGradlePath)) {
  const fullCapacitorGradle = `ext {
    androidxActivityVersion = project.hasProperty('androidxActivityVersion') ? rootProject.ext.androidxActivityVersion : '1.11.0'
    androidxAppCompatVersion = project.hasProperty('androidxAppCompatVersion') ? rootProject.ext.androidxAppCompatVersion : '1.7.1'
    androidxCoordinatorLayoutVersion = project.hasProperty('androidxCoordinatorLayoutVersion') ? rootProject.ext.androidxCoordinatorLayoutVersion : '1.3.0'
    androidxCoreVersion = project.hasProperty('androidxCoreVersion') ? rootProject.ext.androidxCoreVersion : '1.17.0'
    androidxFragmentVersion = project.hasProperty('androidxFragmentVersion') ? rootProject.ext.androidxFragmentVersion : '1.8.9'
    androidxWebkitVersion = project.hasProperty('androidxWebkitVersion') ? rootProject.ext.androidxWebkitVersion : '1.14.0'
    junitVersion = project.hasProperty('junitVersion') ? rootProject.ext.junitVersion : '4.13.2'
    androidxJunitVersion = project.hasProperty('androidxJunitVersion') ? rootProject.ext.androidxJunitVersion : '1.3.0'
    androidxEspressoCoreVersion = project.hasProperty('androidxEspressoCoreVersion') ? rootProject.ext.androidxEspressoCoreVersion : '3.7.0'
    cordovaAndroidVersion = project.hasProperty('cordovaAndroidVersion') ? rootProject.ext.cordovaAndroidVersion : '14.0.1'
}

buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.13.0'
    }
}

tasks.withType(Javadoc).all { enabled = false }

apply plugin: 'com.android.library'

android {
    namespace = "com.getcapacitor.android"
    compileSdk = project.hasProperty('compileSdkVersion') ? rootProject.ext.compileSdkVersion : 35
    defaultConfig {
        minSdkVersion project.hasProperty('minSdkVersion') ? rootProject.ext.minSdkVersion : 24
        targetSdkVersion project.hasProperty('targetSdkVersion') ? rootProject.ext.targetSdkVersion : 35
        versionCode 1
        versionName "1.0"
        consumerProguardFiles 'proguard-rules.pro'
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    lintOptions {
        abortOnError false
        checkReleaseBuilds false
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.core:core:$androidxCoreVersion"
    implementation "androidx.activity:activity:$androidxActivityVersion"
    implementation "androidx.fragment:fragment:$androidxFragmentVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.webkit:webkit:$androidxWebkitVersion"
    implementation "org.apache.cordova:framework:$cordovaAndroidVersion"
    testImplementation "junit:junit:$junitVersion"
}
`;
  fs.writeFileSync(capacitorGradlePath, fullCapacitorGradle, 'utf-8');
  console.log(' [PATCH] Capacitor Android build.gradle restored with ALL 7 core dependencies (Cordova, WebKit, etc.) and Java 17!');
}

// 2. Patch CapacitorHttpUrlConnection to trust self-signed / custom SSL certificates
const httpConnPath = path.join(
  process.cwd(),
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'plugin',
  'util',
  'CapacitorHttpUrlConnection.java'
);

if (fs.existsSync(httpConnPath)) {
  let code = fs.readFileSync(httpConnPath, 'utf-8');
  const targetConstructor = `    public CapacitorHttpUrlConnection(HttpURLConnection conn) {
        connection = conn;
        this.setDefaultRequestProperties();
    }`;

  const replacementConstructor = `    public CapacitorHttpUrlConnection(HttpURLConnection conn) {
        connection = conn;
        if (connection instanceof HttpsURLConnection) {
            try {
                javax.net.ssl.TrustManager[] trustAllCerts = new javax.net.ssl.TrustManager[] {
                    new javax.net.ssl.X509TrustManager() {
                        public java.security.cert.X509Certificate[] getAcceptedIssuers() { return new java.security.cert.X509Certificate[0]; }
                        public void checkClientTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                        public void checkServerTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                    }
                };
                javax.net.ssl.SSLContext sc = javax.net.ssl.SSLContext.getInstance("TLS");
                sc.init(null, trustAllCerts, new java.security.SecureRandom());
                HttpsURLConnection httpsConn = (HttpsURLConnection) connection;
                httpsConn.setSSLSocketFactory(sc.getSocketFactory());
                httpsConn.setHostnameVerifier(new javax.net.ssl.HostnameVerifier() {
                    public boolean verify(String hostname, javax.net.ssl.SSLSession session) {
                        return true;
                    }
                });
            } catch (Exception ignored) {}
        }
        this.setDefaultRequestProperties();
    }`;

  if (code.includes(targetConstructor)) {
    code = code.replace(targetConstructor, replacementConstructor);
    fs.writeFileSync(httpConnPath, code, 'utf-8');
    console.log(' [PATCH] CapacitorHttpUrlConnection patched for SSL!');
  }

  // 2b. Patch setRequestMethod to support WebDAV methods (PROPFIND, MKCOL, etc.) via Java reflection
  const targetSetRequestMethod = `    public void setRequestMethod(String method) throws ProtocolException {
        connection.setRequestMethod(method);
    }`;

  const replacementSetRequestMethod = `    public void setRequestMethod(String method) throws ProtocolException {
        try {
            connection.setRequestMethod(method);
        } catch (final Exception pe) {
            try {
                Class<?> c = connection.getClass();
                java.lang.reflect.Field methodField = null;
                while (c != null) {
                    try {
                        methodField = c.getDeclaredField("method");
                        break;
                    } catch (NoSuchFieldException e) {
                        c = c.getSuperclass();
                    }
                }
                if (methodField != null) {
                    methodField.setAccessible(true);
                    methodField.set(connection, method);
                } else {
                    try {
                        java.lang.reflect.Field delegateField = connection.getClass().getDeclaredField("delegate");
                        delegateField.setAccessible(true);
                        Object delegate = delegateField.get(connection);
                        if (delegate instanceof HttpURLConnection) {
                            ((HttpURLConnection) delegate).setRequestMethod(method);
                        }
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
        }
    }`;

  if (code.includes(targetSetRequestMethod)) {
    code = code.replace(targetSetRequestMethod, replacementSetRequestMethod);
    fs.writeFileSync(httpConnPath, code, 'utf-8');
    console.log(' [PATCH] CapacitorHttpUrlConnection patched for WebDAV methods (PROPFIND/MKCOL)!');
  }
}

// 3. Patch BridgeWebViewClient to allow SSL in WebView
const webViewClientPath = path.join(
  process.cwd(),
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'BridgeWebViewClient.java'
);

if (fs.existsSync(webViewClientPath)) {
  let code = fs.readFileSync(webViewClientPath, 'utf-8');
  if (!code.includes('onReceivedSslError')) {
    const targetHook = `public class BridgeWebViewClient extends WebViewClient {`;
    const sslMethod = `public class BridgeWebViewClient extends WebViewClient {

    @Override
    public void onReceivedSslError(android.webkit.WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
        handler.proceed();
    }
`;
    code = code.replace(targetHook, sslMethod);
    fs.writeFileSync(webViewClientPath, code, 'utf-8');
    console.log(' [PATCH] BridgeWebViewClient patched for SSL proceed!');
  }
}

// 4. Ensure Android resources (splash.xml, colors.xml, mipmaps) exist
const resDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(resDir)) {
  const splashPath = path.join(resDir, 'drawable', 'splash.xml');
  if (!fs.existsSync(splashPath)) {
    fs.mkdirSync(path.dirname(splashPath), { recursive: true });
    fs.writeFileSync(
      splashPath,
      `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="#0f172a" />
    </item>
</layer-list>
`,
      'utf-8'
    );
    console.log(' [PATCH] splash.xml created!');
  }

  const colorsPath = path.join(resDir, 'values', 'colors.xml');
  if (!fs.existsSync(colorsPath)) {
    fs.mkdirSync(path.dirname(colorsPath), { recursive: true });
    fs.writeFileSync(
      colorsPath,
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0f172a</color>
    <color name="colorPrimaryDark">#020617</color>
    <color name="colorAccent">#38bdf8</color>
</resources>
`,
      'utf-8'
    );
    console.log(' [PATCH] colors.xml created!');
  }
}

console.log('[PATCH] Done.');
