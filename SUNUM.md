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
| 1 | Açılış animasyonu ve açılış ekranı | Uygulamayı açın; logo animasyonu, ardından 3 seçenek | `mobile/components/IntroAnimation.js`, `mobile/screens/WelcomeScreen.js` |
| 2 | Giriş ve oturum | Yönetici hesabıyla giriş; uygulamayı kapatıp açınca oturum devam eder | `mobile/screens/LoginScreen.js`, `mobile/services/SessionContext.js`, `backend/routes/account.js`, `backend/middleware/auth.js` |
| 3 | Yönetici ana ekranı | Tahsilat göstergesi (%40), bento kutular, aşağı çekip yenileme | `mobile/screens/ManagerHomeScreen.js`, `mobile/components/Gauge.js`, `mobile/components/Refresh.js` |
| 4 | Renkli daire haritası | "Daire haritası": yeşil / sarı / kırmızı / boş; oklarla ay değiştirme | `mobile/screens/FlatMapScreen.js`, `mobile/components/Status.js`, `backend/routes/dueManagement.js` |
| 5 | Aidat takvimi ve elle işaretleme | Haritada **B4**'e dokunun: son iki ay ve bu ay ödenmemiş; bir aya dokunup "ödendi" işaretleyin | `mobile/screens/DueCalendarScreen.js`, `backend/models/Due.js` |
| 6 | Aidat onayı | "Bekleyen aidatlar" → **A3**'ü onaylayın; sakinin telefonuna bildirim düşer, haritada A3 yeşile döner | `mobile/screens/PendingPaymentsScreen.js`, `backend/services/pushNotifications.js` |
| 7 | Sakin tarafı | İkinci cihazda `lale.a3@ornek.com`: ana ekranda Ekim "Ödendi"; aidat takvimi | `mobile/screens/ResidentHomeScreen.js` |
| 8 | Aidat bildirimi gönderme | Sakin: "Aidat bildirimi gönder" → ay, yöntem, açıklama → gönder; yöneticide bekleyenlere düşer | `mobile/screens/ReportPaymentScreen.js`, `backend/routes/dues.js` |
| 9 | Anlık mesajlaşma | Yönetici "Mesajlar" → Elif Arslan; iki cihazdan yazışın: mesaj anında düşer, ✓ → ✓✓ | `mobile/screens/ChatScreen.js`, `mobile/services/socket.js`, `backend/socket.js`, `backend/routes/messages.js` |
| 10 | Duyuru ve push bildirim | Yönetici "Duyurular" → "Yeni duyuru"; sakinin telefonuna bildirim; "Tekrarlayan" ekranı | `mobile/screens/WriteAnnouncementScreen.js`, `backend/routes/announcements.js`, `backend/services/recurringAnnouncements.js` |
| 11 | Davet kodu ile katılma | "Daireler" → boş bir daire (örn. **A4**) → kod; açılış ekranında "Davet koduyla katıl" | `mobile/screens/InviteCodeScreen.js`, `mobile/screens/JoinWithCodeScreen.js`, `backend/services/inviteCode.js` |
| 12 | Aidat hatırlatması | Ana ekranda "Hatırlatma gönder": ödemeyenlere bildirim (normalde her ayın 10'unda kendiliğinden) | `backend/services/reminders.js` (node-cron) |
| 13 | Bağlantı yok uyarısı | Backend'i durdurun (Ctrl+C): ekranın altında kırmızı şerit; tekrar başlatınca kaybolur | `mobile/components/ConnectionBanner.js`, `mobile/services/api.js` |
| 14 | (İsteğe bağlı) Yönetici devri | "Yöneticiliği devret" → sakinli bir daire; iki cihazın ekranı da yeni role geçer | `mobile/screens/HandoverScreen.js`, `backend/routes/handover.js` |

## Güvenlik sorulursa

- Her sorgu giriş yapan kullanıcının `siteId`'si ile filtrelenir; `siteId` asla istekten alınmaz → `backend/middleware/auth.js`
- Yetki kontrolü backend'de middleware ile yapılır (sadece butonu gizlemek yetmez) → `backend/middleware/auth.js`
- Şifreler bcrypt ile hash'lenir, token telefonda `expo-secure-store` ile şifreli saklanır → `backend/models/User.js`, `mobile/services/SessionContext.js`
- Giriş, kayıt ve kod girişinde deneme sınırı → `backend/middleware/rateLimits.js`
- Gelen veri zod şemalarıyla doğrulanır → `backend/middleware/validate.js`

## Hocanın istediği temel bileşenler projede nerede?

| Bileşen | Kullanıldığı yer |
|---|---|
| `View`, `Text`, `StyleSheet` | Tüm ekranlar ve component'ler |
| `TextInput` | `mobile/components/FormField.js` (tüm formların giriş alanı), `mobile/screens/ChatScreen.js` (mesaj kutusu) |
| `Button` / `Pressable` | Hazır `Button` yerine tasarıma uyan kendi butonumuz: `mobile/components/Button.js` (`Pressable` tabanlı) |
| `Image` | `mobile/screens/WelcomeScreen.js` (açılış ekranındaki logo) |
| `ImageBackground` | `mobile/components/SiteHeader.js` (ana ekranlarda site adı ve sağındaki logo) |
| `FlatList` / `SectionList` / `ScrollView` | `AnnouncementsScreen.js`, `ChatsScreen.js`, `ManagerHomeScreen.js` |
| `useState` / `useEffect` | Her ekranda; açıklamalı örnek: `mobile/services/SessionContext.js` |
