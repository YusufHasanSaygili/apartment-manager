# Görev Listesi

Proje küçük, uçtan uca görevlere (slice) bölünmüştür. Her görev **backend + mobil + test** olarak bitirilir ve sonunda telefonda denenebilecek, çalışan bir şey ortaya çıkar.

**Mevcut görev:** 8.4

Kurallar:
- Görevler sırayla yapılır. Bir görev bitmeden sonrakine geçilmez.
- Bir görev bitince kutusu `[x]` yapılır ve "Mevcut görev" satırı bir sonraki göreve güncellenir.
- Bir görev yapılırken sonraki görevlere ait özellik eklenmez.
- Bir görev beklenenden büyük çıkarsa kullanıcıya sorularak alt görevlere bölünür.

---

## Aşama 0 — Temel

- [x] **0.1 Proje kurulumu**
  - Klasör yapısı, `.gitignore`, `.env.example`, README taslağı
  - Express sunucusu + MongoDB Atlas bağlantısı + sağlık kontrolü route'u (`/api/saglik`)
  - Expo uygulaması + React Navigation + backend adresini okuyan ayar dosyası
  - Deneme: Telefonda açılan uygulama "Sunucuya bağlandı" yazar

- [x] **0.2 Güvenlik ve hata altyapısı**
  - helmet, CORS, rate limit, MongoDB enjeksiyon koruması
  - Gelen veriyi doğrulama yapısı, merkezi hata yönetimi middleware'i
  - Mobilde ortak API servisi (axios) ve ortak hata mesajı gösterimi
  - Deneme: Hatalı bir istek düzgün bir hata mesajıyla döner, uygulama çökmez

## Aşama 1 — Hesap ve Site

- [x] **1.1 Yeni site oluştur**
  - Site ve Kullanici modelleri, kayıt route'u, şifre hash'leme, JWT üretme
  - Mobil: Açılış ekranı (4 buton, "Yeni site oluştur" altında küçük puntoyla "(Yönetici hesabı ile başlar)"), site oluşturma formu
  - Token'ın `expo-secure-store` ile saklanması, boş yönetici ana ekranı
  - Deneme: Yeni site oluşturulur, yönetici ana ekranına geçilir

- [x] **1.2 Giriş yap / Çıkış yap**
  - Giriş route'u + deneme sınırı, JWT doğrulama middleware'i, rol ve site izolasyonu yardımcıları
  - Mobil: Giriş ekranı, çıkış butonu, uygulama açılınca kayıtlı token ile otomatik giriş
  - Deneme: Çıkış yapılır, tekrar giriş yapılır; uygulama kapatılıp açılınca oturum devam eder

- [x] **1.3 Bina ve daire kurulumu**
  - Bina ve Daire modelleri, kurulum route'u, benzersiz 6 haneli davet kodları
  - Mobil: Yönetici kurulum ekranı (bina sayısı, her binadaki daire sayısı)
  - Deneme: 3 bina × 12 daire girilir, A1–C12 daireleri oluşur

- [x] **1.4 Daire listesi ve davet kodları**
  - Dairelerin bina bina listelenmesi (renkler henüz yok)
  - Daireye dokununca davet kodunu gösterme ve paylaşma butonu
  - Deneme: Yönetici bir dairenin kodunu görür ve paylaşır

- [x] **1.5 Davet koduyla katıl**
  - Sakin kayıt route'u, davet kodunun tek kullanımlık olması
  - Mobil: "Davet koduyla katıl" ekranı, sakin ana ekranı (site ve daire bilgisi)
  - Deneme: Sakin kodla kayıt olur; aynı kod ikinci kez kullanılamaz

## Aşama 2 — Aidat

- [x] **2.1 Aidat bildirimi gönder (sakin)**
  - Aidat modeli, bildirim route'u
  - Yönetici sitenin aylık aidat tutarını belirler (Site modeline `aidatTutari`)
  - Mobil: Ay seçimi, tutar (yöneticinin belirlediği tutar hazır gelir, sakin değiştirebilir; en fazla 99.999,99 TL), ödeme yöntemi (Banka havalesi / Elden), açıklama formu; sakinin kendi bildirim geçmişi
  - Deneme: Sakin bildirim atar, durumu "Onay bekliyor" görünür

- [x] **2.2 Bekleyen bildirimler (yönetici)**
  - Onay ve red route'ları; aynı daire aynı ay için ikinci kez onay engeli
  - Mobil: Bekleyen bildirimler listesi, Onayla / Reddet butonları
  - Deneme: Yönetici onaylar; sakin tarafında durum "Ödendi" olur. Reddedilen bildirimden sonra sakin tekrar bildirim atabilir

- [x] **2.3 Renkli daire haritası**
  - Seçilen aya göre daire durumlarını hesaplayan route
  - Mobil: Bina bina ızgara; yeşil = ödedi, sarı = onay bekliyor, kırmızı = ödemedi; ay seçici
  - Deneme: Onaylanan daire yeşile, bekleyen sarıya döner

- [x] **2.4 Aidat takvimi**
  - Daire bazında aylık ödeme geçmişi
  - Mobil: Yönetici bir daireye dokununca takvimi görür; sakin kendi takvimini görür
  - Yönetici bir daire için bir ayı elle "ödendi" işaretleyebilir (örn. sakin 2 aylık ödediyse sonraki ay); işaretlenen aya hatırlatma gitmez
  - Deneme: Onaylanan aylar takvimde işaretli görünür

## Aşama 3 — Duyurular ve Bildirimler

- [x] **3.1 Duyurular**
  - Duyuru modeli, oluşturma ve listeleme route'ları
  - Mobil: Yönetici duyuru yazar, duyuruya dokunarak düzenler veya siler; herkes duyuru listesini görür
  - Deneme: Yönetici duyuru yapar, sakin listede görür

- [x] **3.2 Push bildirim altyapısı**
  - Android Studio ile yerel geliştirme sürümü (`npx expo run:android`)
  - Bildirim izni, push token'ın kaydedilmesi, duyuru yapılınca push gönderme
  - Deneme: Yönetici duyuru yapar, sakinin telefonuna bildirim düşer

- [x] **3.3 Aidat sonucu bildirimi**
  - Aidat onaylanınca veya reddedilince sakine push; yeni aidat bildirimi gelince yöneticiye push
  - Deneme: Onay/red sonrası sakine bildirim gelir

## Aşama 4 — Mesajlaşma

- [x] **4.1 Mesajlaşma temeli**
  - Mesaj modeli, mesaj gönderme ve geçmiş route'ları
  - Mobil: Yönetici için sohbet listesi, ortak sohbet ekranı, sakin için tek sohbet (yönetici)
  - Deneme: Mesaj gönderilir, sayfa yenilenince karşı tarafta görünür

- [x] **4.2 Anlık mesajlaşma (Socket.io)**
  - Socket bağlantısında token doğrulama, kullanıcıyı sadece kendi sohbet odalarına alma
  - Mobil: Mesajların sayfa yenilemeden anında düşmesi
  - Deneme: İki emülatörde mesaj anında karşıya geçer

- [x] **4.3 İletildi / Görüldü ve mesaj bildirimi**
  - ✓ iletildi, ✓✓ görüldü işaretleri; uygulama kapalıyken yeni mesaj push bildirimi
  - Deneme: Mesaj okununca ✓✓ olur

## Aşama 5 — Otomasyon

- [x] **5.1 Aidat hatırlatma**
  - node-cron ile her ayın 10'unda ödemeyen dairelere push
  - Sunum için yöneticinin elle tetikleyebileceği "Hatırlatma gönder" butonu
  - Deneme: Buton ile hatırlatma tetiklenir, ödemeyen sakinlere bildirim düşer

- [x] **5.2 Tekrarlayan duyurular**
  - TekrarlananDuyuru modeli (site, başlık, içerik, gün, saat); ekleme, listeleme, silme route'ları
  - Her saat başı çalışan zamanlanmış görev: vakti gelen tekrarlayan duyuru normal duyuru olarak eklenir ve push gönderilir
  - Mobil: yönetici gün ve saat seçerek tekrarlayan duyuru ekler ve siler (örn. "Her pazartesi 08:00 — Çöp günü")
  - Deneme: Yakın bir saate tekrarlayan duyuru eklenir, vakti gelince sakine bildirim düşer ve duyuru listesinde görünür

## Aşama 6 — Hesap Yönetimi

- [x] **6.1 Sakini daireden çıkarma**
  - Sakinin daireyle bağı kaldırılır, daire için yeni davet kodu üretilir
  - Deneme: Çıkarılan sakin daireye erişemez, yeni kodla başka biri katılır

- [x] **6.2 Yönetici devri**
  - Yönetici sakini olan bir daireyi seçer, o sakin yönetici olur; eski yönetici sakin olur (kayıtlı dairesine veya seçtiği boş daireye)
  - Kullanici modeline daireyeGiris (aidat bu aydan itibaren beklenir); açık uygulamalar soketle yeni role geçer
  - Deneme: Yeni yönetici siteyi tüm geçmişiyle devralır, eski yönetici yetkisini kaybeder ve sakin olur

- [x] **6.3 Hesap silme**
  - Kişisel verilerin silinmesi, aidat kayıtlarının kişiden ayrılarak korunması; yönetici devretmeden silemez
  - Deneme: Sakin hesabını siler, tekrar giriş yapamaz; aidat geçmişi yönetici tarafında durur

- [x] **6.4 Şifremi unuttum**
  - E-posta ile sıfırlama kodu (ücretsiz bir yöntemle; gereken kütüphane eklenmeden önce kullanıcıya sorulur)
  - Deneme: Kod e-postaya gelir, yeni şifreyle giriş yapılır

## Aşama 7 — Son Dokunuşlar

- [x] **7.1 İkon ve açılış ekranı (splash)** → 7.3 ile birleştirildi (7.3 adım 2)
- [x] **7.2 Kullanıcı deneyimi turu:** internet yok uyarısı; tüm ekranlarda yükleniyor, boş liste ve hata durumlarının gözden geçirilmesi
- [x] **7.3 Tasarım turu (Gece Gold, köşeli; önizleme: tasarim-onizleme/):** 4 adımda yapılır, her adım telefonda denenir:
  1. tema.js, gömülü Geist yazı tipleri, özel ikon seti (react-native-svg), ortak component'ler
  2. Giriş öncesi ekranlar + uygulama ikonu ve açılış ekranı (7.1)
  3. Yönetici ekranları
  4. Sakin ekranları
  - İlk tanım: renk paleti (tema.js), ikon ve semboller, buton boyutları, boşluklar ve yazı boyutları; ortak component'ler (Buton, FormAlani, HataMesaji) üzerinden tüm uygulamaya uygulanır. Ekran görüntülerinden (7.5) önce yapılır. İkon kütüphanesi gerekirse önce kullanıcıya sorulur.
- [x] **7.4 Demo verisi:** Sunum için örnek site, daireler, aidatlar ve mesajlar oluşturan script
- [x] **7.5 Teslim hazırlığı:** README'nin son hali ve ekran görüntüleri, sunum akışı
- [x] **7.6 İndirilebilir APK:** Android Studio araçlarıyla yerelde release APK derlenir ve GitHub Releases'a yüklenir. Karar: APK, backend'i çalışan bilgisayarla aynı Wi-Fi'da kullanılır (ders online, sunum evden ekran paylaşımıyla yapılır); backend internete taşınmaz. APK yerel IP'ye `http` ile bağlanabilsin diye cleartext izni verilir.

## Aşama 8 — Kodun İngilizceye Çevrilmesi

Hocanın şartı (2026-10-08): `//` açıklamaları ve ekranda kullanıcının okuduğu yazılar dışında tüm kod İngilizce olacak.
Çalışma kopyası: `A:/Github projeleri/apartment-manager` (veritabanı `apartment-manager`). Eski hal: `Apartmanim` klasörü, `apartmanim` veritabanı ve GitHub'da `turkce-son-surum` etiketi.
Her dilim sonunda uygulama çalışır durumda olur ve telefonda denenir. Türkçe → İngilizce ad sözlüğü `mobile/ders-ornekleri/` içinde tutulur.

- [x] **8.1 Mobil:** Mobildeki tüm adlar (dosyalar, ekranlar, component'ler, servisler, değişkenler); sunucuyla konuşan alan adlarına dokunulmaz
  - Deneme: Uygulama açılır, giriş yapılır, tüm ekranlar eskisi gibi çalışır
- [x] **8.2 Backend:** Backend'deki tüm iç adlar (fonksiyonlar, middleware, servisler, dosyalar, ortam değişkenleri); API ve veritabanı aynı kalır
  - Deneme: Uygulama eskisi gibi çalışır, zamanlanmış görevler çalışır
- [x] **8.3 Ortak dil:** Veritabanı modelleri ve alanları, API yolları, JSON alanları, durum değerleri, soket olayları (backend + mobil birlikte); demo yeniden kurulur
  - Deneme: Tüm özellikler baştan sona denenir
- [ ] **8.4 Kapanış:** Demo betiği, README, SUNUM.md, ders örnekleri ve Türkçe → İngilizce ad sözlüğü
  - Deneme: Belgeler ve örnekler yeni adlarla birebir uyumlu

## Opsiyonel (sadece kullanıcı isterse)

- [ ] **O.1 Gider / şeffaflık ekranı:** Yönetici giderleri girer, sakinler görür
