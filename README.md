# Apartmanım — Site Yönetim Uygulaması

Apartman ve site yöneticileriyle sakinleri bir araya getiren mobil uygulama.
Herkes kendi sitesini kurabilir; her sitenin verisi birbirinden tamamen ayrıdır.

> Proje geliştirme aşamasındadır. Görev listesi ve ilerleme için [GOREVLER.md](GOREVLER.md) dosyasına bakın.

## Özellikler (planlanan)

- Yeni site oluşturma, davet koduyla katılma, yönetici devri
- Bina/daire kurulumu ve renkli daire haritası (ödedi / onay bekliyor / ödemedi)
- "Aidatı verdim" bildirimi ve yönetici onayı, aidat takvimi
- Duyurular ve push bildirimler; belirli gün ve saatte kendiliğinden yayınlanan tekrarlayan duyurular (örn. "Her pazartesi çöp günü")
- Yönetici ile sakin arasında anlık mesajlaşma
- Her ayın 10'unda otomatik aidat hatırlatması

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Mobil | React Native (Expo), React Navigation, axios, expo-secure-store, react-native-keyboard-controller, expo-notifications, socket.io-client |
| Backend | Node.js, Express, zod (veri doğrulama), Socket.io (anlık mesajlaşma), node-cron (zamanlanmış görevler) |
| Giriş | JWT, bcrypt |
| Güvenlik | helmet, CORS, express-rate-limit, MongoDB enjeksiyon koruması |
| Veritabanı | MongoDB Atlas, Mongoose |
| Push bildirim | Expo Push Service + Firebase Cloud Messaging (ücretsiz) |

## Kurulum

### Gereksinimler

- Node.js 20.6 veya üzeri
- Ücretsiz bir MongoDB Atlas hesabı
- Android Studio (Android SDK ve JDK 17+); `ANDROID_HOME` ve `JAVA_HOME` ortam değişkenleri ayarlı
- Geliştirici seçenekleri ve USB/kablosuz hata ayıklaması açık bir Android telefon (telefon ve bilgisayar aynı Wi-Fi ağında olmalı)
- Ücretsiz bir Expo hesabı ve Firebase projesi (push bildirim için)
- **Proje klasörünün yolunda Türkçe karakter (ı, ş, ğ, ü, ö, ç) veya boşluk dışı özel karakter olmamalı.** Android'in C++ derleyicileri bu yolda başarısız olur (örn. `Apartmanım` değil `Apartmanim`).

### 1. Backend

```bash
cd backend
npm install
```

`backend/.env.example` dosyasını kopyalayıp adını `.env` yapın. `MONGODB_URI` değerine
MongoDB Atlas bağlantı adresinizi, `JWT_ANAHTARI` değerine uzun rastgele bir metin yazın
(üretme komutu `.env.example` içinde). Sonra sunucuyu başlatın:

```bash
npm run dev
```

Konsolda `MongoDB bağlantısı kuruldu` ve `Sunucu 3000 portunda çalışıyor` yazmalıdır.
Tarayıcıda `http://localhost:3000/api/saglik` adresi `{"durum":"ok", ...}` döndürür.

### 2. Mobil uygulama

```bash
cd mobile
npm install
```

`mobile/.env.example` dosyasını kopyalayıp adını `.env` yapın ve `EXPO_PUBLIC_API_URL`
değerine bilgisayarınızın yerel IP adresini yazın (Windows'ta `ipconfig` ile öğrenilir), örn.
`http://192.168.1.10:3000`. Sonra:

Push bildirim Expo Go'da çalışmadığı için uygulama Android Studio araçlarıyla yerel geliştirme
sürümü olarak derlenir:

1. Firebase konsolunda bir Android uygulaması ekleyin (paket adı `mobile/app.json` içindeki
   `android.package`), indirilen `google-services.json` dosyasını `mobile/` klasörüne koyun
   (repoya girmez, `.gitignore`'dadır).
2. `npx eas init` ile projeyi kendi Expo hesabınıza bağlayın. expo.dev'de projenin
   **Credentials** sayfasına Firebase'in **FCM V1 service account** anahtarını yükleyin.
3. Telefonu bağlayıp (`adb devices` ile görünmeli) derleyin:

```bash
npx expo prebuild --platform android --clean
```

```bash
npx expo run:android
```

İlk derleme 10-20 dakika sürebilir. Uygulama telefonda açılır ve Metro sunucusuna bağlanır.
Giriş yaptıktan sonra bildirim izni istenir; izin verilirse duyurular telefona bildirim olarak düşer.

### Sorun giderme

- **"Sunucuya ulaşılamadı":** Telefon ve bilgisayar aynı Wi-Fi'de mi? `.env` içindeki IP doğru mu?
  Windows Güvenlik Duvarı Node.js'e "Özel ağlar" için izin veriyor mu?
- **Backend'de `querySrv ECONNREFUSED` hatası:** Bilgisayarın DNS'i Atlas adresini çözemiyor.
  `backend/.env` içine `DNS_SUNUCULARI=1.1.1.1,8.8.8.8` ekleyin.
- `.env` değiştirdikten sonra Metro'yu `npx expo start -c` ile yeniden başlatın.
- **Android derlemesinde CMake/ninja hatası:** Proje yolunda Türkçe karakter var mı? Klasörü yeniden
  adlandırıp `npx expo prebuild --platform android --clean` çalıştırın.
- **Bildirim gelmiyor:** Telefonun ayarlarında uygulamanın bildirim izni açık mı? Duyuruyu yapan kişiye
  bildirim gitmez, sadece sitedeki diğer kişilere gider.

## Klasör yapısı

```
backend/   → Express API sunucusu (models, routes, middleware, server.js)
mobile/    → Expo uygulaması (screens, components, services, App.js)
```
