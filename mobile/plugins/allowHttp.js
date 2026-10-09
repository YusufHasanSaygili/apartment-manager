// Expo eklentisi (config plugin): Android'in "release" sürümünde şifresiz http bağlantısına izin verir.
// Neden gerekli: Android 9'dan beri uygulamalar varsayılan olarak sadece https ile bağlanabilir. Geliştirme sürümünde
// bu izin zaten açıktır, ama indirilebilir APK (release) kapalı gelir. Bizim backend'imiz bilgisayarda yerel IP ile
// http üzerinden çalıştığı için (örn. http://192.168.0.199:3000) izin olmadan APK sunucuya hiç bağlanamazdı.
// android/ klasörü "npx expo prebuild" ile her seferinde yeniden üretildiği için ayar elle değil bu eklentiyle yapılır;
// app.json'daki "plugins" listesine eklendiği sürece her prebuild'de kendiliğinden uygulanır.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function allowHttp(config) {
  // withAndroidManifest: prebuild sırasında AndroidManifest.xml'i okuyup değiştirmemizi sağlar.
  return withAndroidManifest(config, (cfg) => {
    // <application android:usesCleartextTraffic="true"> → http bağlantısına izin
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
};
