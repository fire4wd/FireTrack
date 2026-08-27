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

  // Patch setRequestBody to support binary and avoid zero-byte uploads on WebDAV/Nextcloud
  const targetSetRequestBody = `    public void setRequestBody(PluginCall call, JSValue body, String bodyType) throws JSONException, IOException {`;
  const replacementSetRequestBody = `    public void setRequestBody(PluginCall call, JSValue body, String bodyType) throws JSONException, IOException {
        String contentType = connection.getRequestProperty("Content-Type");
        if (contentType == null || contentType.isEmpty()) {
            contentType = "application/octet-stream";
            connection.setRequestProperty("Content-Type", contentType);
        }

        if (bodyType != null && (bodyType.equals("file") || bodyType.equals("binary") || bodyType.equals("base64"))) {
            byte[] bytes;
            String raw = body != null ? body.toString() : call.getString("data", "");
            if (raw == null) raw = "";
            try {
                int commaIdx = raw.indexOf(",");
                if (commaIdx != -1 && raw.startsWith("data:")) {
                    raw = raw.substring(commaIdx + 1);
                }
                bytes = android.util.Base64.decode(raw.trim(), android.util.Base64.DEFAULT);
            } catch (Exception e) {
                bytes = raw.getBytes(StandardCharsets.UTF_8);
            }
            connection.setFixedLengthStreamingMode(bytes.length);
            try (DataOutputStream os = new DataOutputStream(connection.getOutputStream())) {
                os.write(bytes, 0, bytes.length);
                os.flush();
            }
            return;
        }

        if (contentType.contains("application/json") || bodyType == null) {
            if (!contentType.contains("application/x-www-form-urlencoded") && !contentType.contains("multipart/form-data")) {
                JSArray jsArray = null;
                String dataString = "";
                if (body != null) {
                    dataString = body.toString();
                } else {
                    jsArray = call.getArray("data", null);
                }
                if (jsArray != null) {
                    dataString = jsArray.toString();
                } else if (body == null) {
                    dataString = call.getString("data");
                }
                byte[] bytes = (dataString != null ? dataString : "").getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (DataOutputStream os = new DataOutputStream(connection.getOutputStream())) {
                    os.write(bytes, 0, bytes.length);
                    os.flush();
                }
                return;
            }
        }

        if (contentType.contains("application/x-www-form-urlencoded")) {
            try {
                JSObject obj = body.toJSObject();
                this.writeObjectRequestBody(obj);
                return;
            } catch (Exception e) {
                this.writeRequestBody(body.toString());
                return;
            }
        } else if (bodyType != null && bodyType.equals("formData")) {
            String boundary = extractBoundaryFromContentType(contentType);
            if (boundary == null) {
                boundary = UUID.randomUUID().toString();
                connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            }
            this.writeFormDataRequestBody(boundary, body.toJSArray());
            return;
        } else {
            byte[] bytes = (body != null ? body.toString() : "").getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (DataOutputStream os = new DataOutputStream(connection.getOutputStream())) {
                os.write(bytes, 0, bytes.length);
                os.flush();
            }
            return;
        }
    }

    private void dummy_old_setRequestBody(PluginCall call, JSValue body, String bodyType) throws JSONException, IOException {`;

  if (code.includes(targetSetRequestBody) && !code.includes('dummy_old_setRequestBody')) {
    code = code.replace(targetSetRequestBody, replacementSetRequestBody);
    fs.writeFileSync(httpConnPath, code, 'utf-8');
    console.log(' [PATCH] CapacitorHttpUrlConnection setRequestBody patched for exact streaming length!');
  } else if (code.includes('public void setRequestBody(PluginCall call, JSValue body, String bodyType) throws JSONException, IOException {') && code.includes('dummy_old_setRequestBody')) {
    // Replace the already patched setRequestBody
    const startIdx = code.indexOf('public void setRequestBody(PluginCall call, JSValue body, String bodyType)');
    const endIdx = code.indexOf('private void dummy_old_setRequestBody');
    if (startIdx !== -1 && endIdx !== -1) {
      code = code.substring(0, startIdx) + replacementSetRequestBody.trim() + '\n\n    ' + code.substring(endIdx);
      fs.writeFileSync(httpConnPath, code, 'utf-8');
      console.log(' [PATCH] CapacitorHttpUrlConnection setRequestBody updated with newest streaming fix!');
    }
  }
}

// 2b. Patch HttpRequestHandler to remove conflicting Content-Length headers
const httpHandlerPath = path.join(
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
  'HttpRequestHandler.java'
);

if (fs.existsSync(httpHandlerPath)) {
  let code = fs.readFileSync(httpHandlerPath, 'utf-8');
  if (!code.includes('headers.remove("Content-Length");')) {
    const targetHeaders = `JSObject headers = call.getObject("headers", new JSObject());`;
    const replacementHeaders = `JSObject headers = call.getObject("headers", new JSObject());
        if (headers != null) {
            headers.remove("Content-Length");
            headers.remove("content-length");
        }`;
    if (code.includes(targetHeaders)) {
      code = code.replace(targetHeaders, replacementHeaders);
      fs.writeFileSync(httpHandlerPath, code, 'utf-8');
      console.log(' [PATCH] HttpRequestHandler patched to remove duplicate Content-Length headers!');
    }
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
