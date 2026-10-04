# Sunum Akışı

Bu dosya, projeyi derste gösterirken izlenecek sırayı anlatır. Her adımın yanında, hoca "bu kod nerede?"
diye sorarsa açılacak dosyalar var. Toplam süre yaklaşık 10–12 dakika.

## Sunumdan önce (5 dakika)

1. Bilgisayarda backend'i başlatın: `cd backend` → `npm run dev`. Konsolda `MongoDB bağlantısı kuruldu` görünmeli.
   - Atlas bağlanmıyorsa: bilgisayarın dış IP'si değişmiş olabilir → MongoDB Atlas → Security → IP Access List → Add Current IP.
2. Demo verisini tazeleyin: `npm run demo`. Tarihler o güne göre yeniden hesaplanır; "bugün" duyurusu ve
   okunmamış mesaj yeniden oluşur. (Sunumda yapılan onay, mesaj vb. değişiklikler de böylece sıfırlanır.)
3. Mobil: `cd mobile` → `npx expo start --dev-client`. Telefon kabloyla/kablosuz bağlıysa
   `adb reverse tcp:8081 tcp:8081` ve `adb reverse tcp:3000 tcp:3000` çalıştırın, uygulamayı açın.
4. Anlık mesajlaşmayı göstermek için ikinci cihaz gerekir: ikinci telefon veya Android Studio emülatörü.
   Biri yönetici, diğeri sakin hesabıyla giriş yapar.

**Demo hesapları** (şifre hepsinde `Demo1234`): yönetici `lale.yonetici@ornek.com`, sakin `lale.a3@ornek.com`.
Diğer sakinler README'deki tabloda.

## Gösterim sırası

| # | Ne gösterilir | Nasıl | İlgili kod |
|---|---|---|---|
| 1 | Açılış animasyonu ve açılış ekranı | Uygulamayı açın; logo animasyonu, ardından 3 seçenek | `mobile/components/AcilisAnimasyonu.js`, `mobile/screens/AcilisEkrani.js` |
| 2 | Giriş ve oturum | Yönetici hesabıyla giriş; uygulamayı kapatıp açınca oturum devam eder | `mobile/screens/GirisEkrani.js`, `mobile/services/OturumContext.js`, `backend/routes/hesap.js`, `backend/middleware/kimlik.js` |
| 3 | Yönetici ana ekranı | Tahsilat göstergesi (%40), bento kutular, aşağı çekip yenileme | `mobile/screens/YoneticiAnaEkrani.js`, `mobile/components/Gosterge.js`, `mobile/components/Yenileme.js` |
| 4 | Renkli daire haritası | "Daire haritası": yeşil / sarı / kırmızı / boş; oklarla ay değiştirme | `mobile/screens/DaireHaritasiEkrani.js`, `mobile/components/Durum.js`, `backend/routes/aidatYonetim.js` |
| 5 | Aidat takvimi ve elle işaretleme | Haritada **B4**'e dokunun: son iki ay ve bu ay ödenmemiş; bir aya dokunup "ödendi" işaretleyin | `mobile/screens/AidatTakvimiEkrani.js`, `backend/models/Aidat.js` |
| 6 | Aidat onayı | "Bekleyen aidatlar" → **A3**'ü onaylayın; sakinin telefonuna bildirim düşer, haritada A3 yeşile döner | `mobile/screens/BekleyenBildirimlerEkrani.js`, `backend/services/bildirim.js` |
| 7 | Sakin tarafı | İkinci cihazda `lale.a3@ornek.com`: ana ekranda Ekim "Ödendi"; aidat takvimi | `mobile/screens/SakinAnaEkrani.js` |
| 8 | Aidat bildirimi gönderme | Sakin: "Aidat bildirimi gönder" → ay, yöntem, açıklama → gönder; yöneticide bekleyenlere düşer | `mobile/screens/AidatBildirEkrani.js`, `backend/routes/aidatlar.js` |
| 9 | Anlık mesajlaşma | Yönetici "Mesajlar" → Elif Arslan; iki cihazdan yazışın: mesaj anında düşer, ✓ → ✓✓ | `mobile/screens/SohbetEkrani.js`, `mobile/services/soket.js`, `backend/soket.js`, `backend/routes/mesajlar.js` |
| 10 | Duyuru ve push bildirim | Yönetici "Duyurular" → "Yeni duyuru"; sakinin telefonuna bildirim; "Tekrarlayan" ekranı | `mobile/screens/DuyuruYazEkrani.js`, `backend/routes/duyurular.js`, `backend/services/tekrarlananDuyuru.js` |
| 11 | Davet kodu ile katılma | "Daireler" → boş bir daire (örn. **A4**) → kod; açılış ekranında "Davet koduyla katıl" | `mobile/screens/DaireKoduEkrani.js`, `mobile/screens/DavetKatilEkrani.js`, `backend/services/davetKodu.js` |
| 12 | Aidat hatırlatması | Ana ekranda "Hatırlatma gönder": ödemeyenlere bildirim (normalde her ayın 10'unda kendiliğinden) | `backend/services/hatirlatma.js` (node-cron) |
| 13 | Bağlantı yok uyarısı | Backend'i durdurun (Ctrl+C): ekranın altında kırmızı şerit; tekrar başlatınca kaybolur | `mobile/components/BaglantiSeridi.js`, `mobile/services/api.js` |
| 14 | (İsteğe bağlı) Yönetici devri | "Yöneticiliği devret" → sakinli bir daire; iki cihazın ekranı da yeni role geçer | `mobile/screens/DevirEkrani.js`, `backend/routes/devir.js` |

## Güvenlik sorulursa

- Her sorgu giriş yapan kullanıcının `siteId`'si ile filtrelenir; `siteId` asla istekten alınmaz → `backend/middleware/kimlik.js`
- Yetki kontrolü backend'de middleware ile yapılır (sadece butonu gizlemek yetmez) → `backend/middleware/kimlik.js`
- Şifreler bcrypt ile hash'lenir, token telefonda `expo-secure-store` ile şifreli saklanır → `backend/models/Kullanici.js`, `mobile/services/OturumContext.js`
- Giriş, kayıt ve kod girişinde deneme sınırı → `backend/middleware/denemeSiniri.js`
- Gelen veri zod şemalarıyla doğrulanır → `backend/middleware/dogrula.js`

## Hocanın istediği temel bileşenler projede nerede?

| Bileşen | Kullanıldığı yer |
|---|---|
| `View`, `Text`, `StyleSheet` | Tüm ekranlar ve component'ler |
| `TextInput` | `mobile/components/FormAlani.js` (tüm formların giriş alanı), `mobile/screens/SohbetEkrani.js` (mesaj kutusu) |
| `Button` / `Pressable` | Hazır `Button` yerine tasarıma uyan kendi butonumuz: `mobile/components/Buton.js` (`Pressable` tabanlı) |
| `Image` | `mobile/screens/AcilisEkrani.js` (açılış ekranındaki logo) |
| `ImageBackground` | `mobile/components/SiteBasligi.js` (ana ekranlarda site adı ve sağındaki logo) |
| `FlatList` / `SectionList` / `ScrollView` | `DuyurularEkrani.js`, `SohbetlerEkrani.js`, `YoneticiAnaEkrani.js` |
| `useState` / `useEffect` | Her ekranda; açıklamalı örnek: `mobile/services/OturumContext.js` |
