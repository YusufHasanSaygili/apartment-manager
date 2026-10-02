# Apartmanım — Site Yönetim Uygulaması

Apartman ve site yöneticileriyle sakinleri bir araya getiren mobil uygulama.
Herkes kendi sitesini kurabilir; her sitenin verisi birbirinden tamamen ayrıdır.

> Proje geliştirme aşamasındadır. Görev listesi ve ilerleme için [GOREVLER.md](GOREVLER.md) dosyasına bakın.

## Özellikler (planlanan)

- Yeni site oluşturma, davet koduyla katılma, yönetici devri
- Bina/daire kurulumu ve renkli daire haritası (ödedi / onay bekliyor / ödemedi)
- "Aidatı verdim" bildirimi ve yönetici onayı, aidat takvimi
- Duyurular ve push bildirimler
- Yönetici ile sakin arasında anlık mesajlaşma
- Her ayın 10'unda otomatik aidat hatırlatması

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Mobil | React Native (Expo), React Navigation, axios |
| Backend | Node.js, Express, zod (veri doğrulama) |
| Güvenlik | helmet, CORS, express-rate-limit, MongoDB enjeksiyon koruması |
| Veritabanı | MongoDB Atlas, Mongoose |

## Kurulum

### Gereksinimler

- Node.js 20.6 veya üzeri
- Ücretsiz bir MongoDB Atlas hesabı
- Telefonda **Expo Go** uygulaması (telefon ve bilgisayar aynı Wi-Fi ağında olmalı)

### 1. Backend

```bash
cd backend
npm install
```

`backend/.env.example` dosyasını kopyalayıp adını `.env` yapın ve `MONGODB_URI` değerine
MongoDB Atlas bağlantı adresinizi yazın. Sonra sunucuyu başlatın:

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

```bash
npx expo start
```

Çıkan QR kodu telefondaki Expo Go ile okutun. Ekranda **"Sunucuya bağlandı"** yazmalıdır.

### Sorun giderme

- **"Sunucuya ulaşılamadı":** Telefon ve bilgisayar aynı Wi-Fi'de mi? `.env` içindeki IP doğru mu?
  Windows Güvenlik Duvarı Node.js'e "Özel ağlar" için izin veriyor mu?
- **Backend'de `querySrv ECONNREFUSED` hatası:** Bilgisayarın DNS'i Atlas adresini çözemiyor.
  `backend/.env` içine `DNS_SUNUCULARI=1.1.1.1,8.8.8.8` ekleyin.
- `.env` değiştirdikten sonra Expo'yu `npx expo start -c` ile yeniden başlatın.

## Klasör yapısı

```
backend/   → Express API sunucusu (models, routes, middleware, server.js)
mobile/    → Expo uygulaması (screens, components, services, App.js)
```
