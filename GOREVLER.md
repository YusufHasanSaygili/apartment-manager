# Görev Listesi

Proje küçük, uçtan uca görevlere (slice) bölünmüştür. Her görev **backend + mobil + test** olarak bitirilir ve sonunda telefonda denenebilecek, çalışan bir şey ortaya çıkar.

**Mevcut görev:** 1.3

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

- [ ] **1.3 Bina ve daire kurulumu**
  - Bina ve Daire modelleri, kurulum route'u, benzersiz 6 haneli davet kodları
  - Mobil: Yönetici kurulum ekranı (bina sayısı, her binadaki daire sayısı)
  - Deneme: 3 bina × 12 daire girilir, A1–C12 daireleri oluşur

- [ ] **1.4 Daire listesi ve davet kodları**
  - Dairelerin bina bina listelenmesi (renkler henüz yok)
  - Daireye dokununca davet kodunu gösterme ve paylaşma butonu
  - Deneme: Yönetici bir dairenin kodunu görür ve paylaşır

- [ ] **1.5 Davet koduyla katıl**
  - Sakin kayıt route'u, davet kodunun tek kullanımlık olması
  - Mobil: "Davet koduyla katıl" ekranı, sakin ana ekranı (site ve daire bilgisi)
  - Deneme: Sakin kodla kayıt olur; aynı kod ikinci kez kullanılamaz

## Aşama 2 — Aidat

- [ ] **2.1 Aidat bildirimi gönder (sakin)**
  - Aidat modeli, bildirim route'u
  - Mobil: Ay seçimi, ödeme yöntemi (Banka havalesi / Elden), açıklama formu; sakinin kendi bildirim geçmişi
  - Deneme: Sakin bildirim atar, durumu "Onay bekliyor" görünür

- [ ] **2.2 Bekleyen bildirimler (yönetici)**
  - Onay ve red route'ları; aynı daire aynı ay için ikinci kez onay engeli
  - Mobil: Bekleyen bildirimler listesi, Onayla / Reddet butonları
  - Deneme: Yönetici onaylar; sakin tarafında durum "Ödendi" olur. Reddedilen bildirimden sonra sakin tekrar bildirim atabilir

- [ ] **2.3 Renkli daire haritası**
  - Seçilen aya göre daire durumlarını hesaplayan route
  - Mobil: Bina bina ızgara; yeşil = ödedi, sarı = onay bekliyor, kırmızı = ödemedi; ay seçici
  - Deneme: Onaylanan daire yeşile, bekleyen sarıya döner

- [ ] **2.4 Aidat takvimi**
  - Daire bazında aylık ödeme geçmişi
  - Mobil: Yönetici bir daireye dokununca takvimi görür; sakin kendi takvimini görür
  - Deneme: Onaylanan aylar takvimde işaretli görünür

## Aşama 3 — Duyurular ve Bildirimler

- [ ] **3.1 Duyurular**
  - Duyuru modeli, oluşturma ve listeleme route'ları
  - Mobil: Yönetici duyuru yazar; herkes duyuru listesini görür
  - Deneme: Yönetici duyuru yapar, sakin listede görür

- [ ] **3.2 Push bildirim altyapısı**
  - Android Studio ile yerel geliştirme sürümü (`npx expo run:android`)
  - Bildirim izni, push token'ın kaydedilmesi, duyuru yapılınca push gönderme
  - Deneme: Yönetici duyuru yapar, sakinin telefonuna bildirim düşer

- [ ] **3.3 Aidat sonucu bildirimi**
  - Aidat onaylanınca veya reddedilince sakine push; yeni aidat bildirimi gelince yöneticiye push
  - Deneme: Onay/red sonrası sakine bildirim gelir

## Aşama 4 — Mesajlaşma

- [ ] **4.1 Mesajlaşma temeli**
  - Mesaj modeli, mesaj gönderme ve geçmiş route'ları
  - Mobil: Yönetici için sohbet listesi, ortak sohbet ekranı, sakin için tek sohbet (yönetici)
  - Deneme: Mesaj gönderilir, sayfa yenilenince karşı tarafta görünür

- [ ] **4.2 Anlık mesajlaşma (Socket.io)**
  - Socket bağlantısında token doğrulama, kullanıcıyı sadece kendi sohbet odalarına alma
  - Mobil: Mesajların sayfa yenilemeden anında düşmesi
  - Deneme: İki emülatörde mesaj anında karşıya geçer

- [ ] **4.3 İletildi / Görüldü ve mesaj bildirimi**
  - ✓ iletildi, ✓✓ görüldü işaretleri; uygulama kapalıyken yeni mesaj push bildirimi
  - Deneme: Mesaj okununca ✓✓ olur

## Aşama 5 — Otomasyon

- [ ] **5.1 Aidat hatırlatma**
  - node-cron ile her ayın 10'unda ödemeyen dairelere push
  - Sunum için yöneticinin elle tetikleyebileceği "Hatırlatma gönder" butonu
  - Deneme: Buton ile hatırlatma tetiklenir, ödemeyen sakinlere bildirim düşer

## Aşama 6 — Hesap Yönetimi

- [ ] **6.1 Sakini daireden çıkarma**
  - Sakinin daireyle bağı kaldırılır, daire için yeni davet kodu üretilir
  - Deneme: Çıkarılan sakin daireye erişemez, yeni kodla başka biri katılır

- [ ] **6.2 Yönetici devri**
  - 24 saat geçerli, tek kullanımlık devir kodu; "Devir koduyla yönetici ol" ekranı
  - Deneme: Yeni yönetici siteyi tüm geçmişiyle devralır, eski yönetici yetkisini kaybeder

- [ ] **6.3 Hesap silme**
  - Kişisel verilerin silinmesi, aidat kayıtlarının kişiden ayrılarak korunması; yönetici devretmeden silemez
  - Deneme: Sakin hesabını siler, tekrar giriş yapamaz; aidat geçmişi yönetici tarafında durur

- [ ] **6.4 Şifremi unuttum**
  - E-posta ile sıfırlama kodu (ücretsiz bir yöntemle; gereken kütüphane eklenmeden önce kullanıcıya sorulur)
  - Deneme: Kod e-postaya gelir, yeni şifreyle giriş yapılır

## Aşama 7 — Son Dokunuşlar

- [ ] **7.1 İkon ve açılış ekranı (splash)**
- [ ] **7.2 Kullanıcı deneyimi turu:** internet yok uyarısı; tüm ekranlarda yükleniyor, boş liste ve hata durumlarının gözden geçirilmesi
- [ ] **7.3 Demo verisi:** Sunum için örnek site, daireler, aidatlar ve mesajlar oluşturan script
- [ ] **7.4 Teslim hazırlığı:** README'nin son hali ve ekran görüntüleri, sunum akışı
- [ ] **7.5 İndirilebilir APK:** Android Studio araçlarıyla yerelde release APK derlenir ve GitHub Releases'a yüklenir. Karar: APK, backend'i çalışan bilgisayarla aynı Wi-Fi'da kullanılır (ders online, sunum evden ekran paylaşımıyla yapılır); backend internete taşınmaz. APK yerel IP'ye `http` ile bağlanabilsin diye cleartext izni verilir.

## Opsiyonel (sadece kullanıcı isterse)

- [ ] **O.1 Gider / şeffaflık ekranı:** Yönetici giderleri girer, sakinler görür
