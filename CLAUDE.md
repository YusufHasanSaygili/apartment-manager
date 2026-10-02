# Site Yönetim Otomasyonu — Proje Talimatları

Bu dosya, bu projede çalışan yapay zeka asistanının nasıl çalışacağını tanımlar.
Her oturumun başında bu dosyayı oku. Projeyi yeniden keşfetmeye çalışma, burada yazanları esas al.

---

## Proje Nedir?

Mobil Programlama dersi için hazırlanan bir **Apartman/Site Yönetim** mobil uygulaması.
Uygulama tamamen mobildir. Bilgisayar sadece geliştirme yapmak ve backend sunucusunu çalıştırmak için kullanılır.

Öğrenciler final sınavında bu projedeki **React kodlarından sorumludur**.
Kod profesyonel standartta yazılır; anlaşılırlık açıklama satırlarıyla sağlanır (bkz. "Kod Açıklamaları").

---

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Mobil uygulama | React Native (Expo) |
| Ekran geçişleri | React Navigation |
| Backend | Node.js + Express |
| Veritabanı | MongoDB Atlas + Mongoose |
| Giriş sistemi | JWT + bcrypt |
| Anlık mesajlaşma | Socket.io |
| Push bildirim | expo-notifications |
| Otomatik görevler | node-cron |
| HTTP istekleri | axios |
| Emülatör | Android Studio |

Yukarıdaki listede olmayan bir kütüphane eklemeden önce kullanıcıya sor ve nedenini açıkla.

---

## Eklentiler ve Kullanım Kuralları

Bu projede **sadece** aşağıdaki 4 eklenti kullanılır. Aynı veya benzer isimli başka bir eklenti, fork ya da sürüm kullanma.
Çakıştıklarında **bu dosyadaki kurallar önceliklidir.**

| Eklenti | Resmi adres | Ne için | Kural |
|---|---|---|---|
| **Context7** | https://context7.com | Expo, React Navigation, expo-notifications, Mongoose gibi kütüphanelerin güncel dokümanı | Bir kütüphane API'sini kullanmadan önce güncel kullanımını Context7 ile kontrol et. |
| **ponytail** | https://github.com/DietrichGebert/ponytail | Gereksiz kod ve kütüphaneden kaçınmak | `full` modunda kullan, `ultra` kullanma. Kod kısalabilir ama **`//` açıklamaları asla kısaltılmaz veya silinmez.** |
| **vercel-react-native-skills** | https://github.com/vercel-labs/agent-skills (sadece React Native skill'i) | React Native / Expo iyi uygulamaları | React Native kodunu bu kurallara göre yaz. Önerdiği yeni bir kütüphane (Zustand, Reanimated vb.) gerçekten fayda sağlıyorsa öner, eklemeden önce kullanıcıya sor. Vercel'in web/Next.js skill'lerini kullanma. |
| **UI UX Pro Max** | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | Renk, yazı tipi, düzen ve UX kararları | Sadece tasarım kararları için kullan. shadcn/ui veya web component'i **önerme**; bu proje React Native: `View`, `Text`, `Pressable`, `StyleSheet`. Ekstra UI kütüphanesi eklemeden önce kullanıcıya sor. |

### Kurulum komutları (Claude Code)

```
# ponytail (iki ayrı mesaj olarak gönder)
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail

# UI UX Pro Max (iki ayrı mesaj olarak gönder)
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill

# Vercel React Native skill (terminalde, proje klasöründe)
npx skills add vercel-labs/agent-skills --skill vercel-react-native-skills

# Context7: https://context7.com/install sayfasındaki Claude Code komutunu kullan
```

---

## Çoklu Site Yapısı

Uygulama **profesyonel bir ürün kalitesinde** yapılır ama şimdilik yerel geliştirme ortamında çalışır (backend bilgisayarda, uygulama telefonda/emülatörde). Play Store yayını ve ücretli servisler kapsam dışıdır. Yapı, ileride yayına alınması gerekirse büyük değişiklik gerektirmeyecek şekilde kurulur.

Uygulama **tek bir site için değil, herkesin kendi sitesini kurabileceği** şekilde tasarlanır.

- Uygulamayı indiren herhangi biri **"Yeni site oluştur"** diyerek kendi sitesini/apartmanını kurar ve o sitenin yöneticisi olur.
- Her sitenin verisi (binalar, daireler, kullanıcılar, aidatlar, duyurular, mesajlar) **birbirinden tamamen ayrıdır**. Bir sitedeki hiç kimse başka bir sitenin verisini göremez, değiştiremez, varlığını bile öğrenemez.
- Bir kullanıcı hesabı **tek bir siteye** bağlıdır.

### Açılış Ekranı Akışı
1. **Giriş yap:** Hesabı olan herkes.
2. **Yeni site oluştur:** Yönetici olacak kişi. Butonun altında/yanında küçük puntoyla **"(Yönetici hesabı ile başlar)"** yazar. Kişi hesap bilgileri + site adı girer, ardından bina/daire kurulumuna geçer.
3. **Davet koduyla katıl:** Sakin. Dairesinin davet kodunu girer, hesabı o daireye ve siteye bağlanır.
4. **Devir koduyla yönetici ol:** Mevcut bir sitenin yöneticiliğini devralan kişi (bkz. Yönetici Devri).

### Yönetici Devri
Yönetici değiştiğinde site **sıfırdan kurulmaz**; aidat geçmişi, daireler ve sakin hesapları korunur.
- Mevcut yönetici ayarlardan **"Yöneticiliği devret"** der. Sistem tek kullanımlık, 24 saat geçerli bir **devir kodu** üretir.
- Yeni yönetici uygulamayı indirir, **"Devir koduyla yönetici ol"** seçeneğiyle hesap açar (veya giriş yapar) ve kodu girer.
- Devir tamamlanınca eski yöneticinin yönetici yetkisi kalkar ve siteden çıkarılır. O sitede oturmaya devam ediyorsa dairesinin davet koduyla sakin olarak tekrar katılabilir.

---

## Kullanıcı Rolleri

### Yönetici
- Siteyi oluşturur. İlk girişte bina sayısını ve her binadaki daire sayısını girer. Sistem daireleri otomatik oluşturur (A1, A2... B1, B2...) ve her daireye 6 haneli bir **davet kodu** üretir.
- **Renkli daire haritası** görür: yeşil = ödedi, sarı = onay bekliyor, kırmızı = ödemedi.
- Gelen "aidatı verdim" bildirimlerini **onaylar veya reddeder**. Onaylanan ödeme o ayın takvimine işlenir.
- Tüm siteye **duyuru** yapar ("Bugün çöp günü", "Tadilat olacak"). Duyuru tüm telefonlara push bildirim olarak gider.
- Sakinlerle **mesajlaşır**.
- Daire el değiştirdiğinde eski sakini daireden çıkarır ve o daire için **yeni davet kodu** üretir.
- Yöneticiliği devir koduyla başka birine devreder.

### Daire Sakini
- Davet koduyla kayıt olur, hesabı otomatik olarak kendi dairesine bağlanır.
- **"Aidatı verdim" bildirimi** atar: ödeme yöntemi (Banka havalesi / Elden) + açıklama (örn. "Ziraat'ten 1 Ekim'de attım").
- Yöneticiye **mesaj** atar (düz metin, WhatsApp benzeri, "iletildi ✓ / görüldü ✓✓").
- Duyuruları görür ve bildirim alır.
- Sakin **sadece kendi dairesinin** verilerini görebilir.

### Herkes
- Hesabını uygulama içinden **kalıcı olarak silebilir**. Yönetici, önce yöneticiliği devretmeden hesabını silemez.

### Sistem
- Her ayın 10'unda, o ayın aidatını ödemeyen dairelere otomatik hatırlatma bildirimi gönderir.

### Opsiyonel (sadece kullanıcı isterse)
- Gider/şeffaflık ekranı: yönetici giderleri girer (bekçi maaşı, elektrik vb.), sakinler görür.

---

## Veri Modelleri (taslak)

`Site` dışındaki **her modelde `siteId` bulunur** ve her sorgu bu alana göre filtrelenir.

- **Site:** ad, yoneticiId, aidatTutari (yöneticinin belirlediği aylık tutar), devirKodu (hash), devirKoduSonTarih, olusturmaTarihi
- **Kullanici:** siteId, ad, e-posta (giriş için, benzersiz), şifre (hash), rol (`yonetici` / `sakin`), daireId (sakinse), pushToken
- **Bina:** siteId, ad (A, B, C...)
- **Daire:** siteId, binaId, daireNo, davetKodu, davetKoduKullanildi, sakinId
- **Aidat:** siteId, daireId, ay, yil, tutar, odemeYontemi (`banka` / `elden`), aciklama, durum (`bekliyor` / `onaylandi` / `reddedildi`), tarih
- **Duyuru:** siteId, baslik, icerik, tarih
- **Mesaj:** siteId, gonderenId, aliciId, icerik, okundu, tarih

Bir modeli değiştirmeden önce kullanıcıya sor.

---

## Klasör Yapısı

```
site-yonetim/
├── backend/
│   ├── models/       → Mongoose şemaları
│   ├── routes/       → API uçları
│   ├── middleware/   → Giriş ve rol kontrolü
│   └── server.js     → Sunucunun başladığı dosya
└── mobile/
    ├── screens/      → Ekranlar
    ├── components/   → Tekrar kullanılan parçalar
    ├── services/     → API ve socket bağlantısı
    └── App.js        → Uygulamanın giriş noktası
```

---

## EN ÖNEMLİ KURAL: Kod Açıklamaları

Hoca derste "bu kod ne işe yarıyor?" diye soracak. Bu yüzden:

1. Önemli her kod bloğunun üstüne veya yanına **Türkçe `//` açıklaması** yaz.
2. Açıklama **ne yaptığını VE neden orada olduğunu** anlatsın.
   - Kötü: `// state tanımlandı`
   - İyi: `// useState: aidatın onaylanıp onaylanmadığını tutar. Değişince ekran kendini otomatik yeniler.`
3. Her satıra açıklama yazma. Şunlara mutlaka yaz:
   - Her ekranın/component'in en üstüne: bu ekran ne işe yarar
   - `useState`, `useEffect` kullanımları
   - Her dosyadaki butonlardan **3-4 tanesine**: basınca ne olur, hangi fonksiyon çalışır
   - API istekleri: hangi veriyi nereye gönderiyor
   - Backend'deki her route: ne yapar, kim kullanabilir
   - Rol/yetki kontrolleri
4. Açıklamalar sade Türkçe olsun, bir öğrencinin sınavda kendi cümleleriyle anlatabileceği seviyede.
5. JSX içinde açıklama için `{/* ... */}` kullan.

---

## Kod Yazma Kuralları

- Kodu **profesyonel standartta** yaz: fonksiyonel component, hook'lar, temiz klasör yapısı, tekrar kullanılabilir parçalar, düzgün hata yönetimi. React en iyi uygulamalarını takip et.
- Değişken ve fonksiyon isimleri **Türkçe ve anlamlı** olabilir (`aidatOnayla`, `duyuruGonder`).
- Bir görevde sadece o görevin işini yap. Sonraki görevlerin özelliklerini önceden ekleme.
- Çalışan kodu sadece stil yüzünden baştan yazma. Küçük, odaklı değişiklik yap.
- Mevcut dosyayı düzenle, gerekmedikçe tüm dosyayı yeniden üretme.

---

## Güvenlik Kuralları

### Site izolasyonu (en kritik kural)
- `siteId` ve `daireId` **asla istekten alınmaz**; her zaman giriş yapmış kullanıcının token'ından ve veritabanındaki kaydından alınır.
- Site verisi içeren her sorgu `siteId` filtresi içerir. Filtresiz sorgu yazılmaz.
- Başka bir siteye ait bir kayıt istendiğinde "bulunamadı" (404) dönülür; kaydın var olduğu belli edilmez.
- Sakin sadece kendi dairesinin aidat ve mesaj verisine erişebilir.

### Yetki
- Yetki kontrolü **backend'de** middleware ile yapılır; sadece ekranda butonu gizlemek yetmez.
- Yönetici işlemleri (daire oluşturma, aidat onayı, duyuru, devir, sakin çıkarma) sadece o sitenin yöneticisi tarafından yapılabilir.

### Hesap ve giriş
- Şifreler bcrypt ile hashlenir, asla düz metin saklanmaz veya loglanmaz.
- JWT'nin bir geçerlilik süresi vardır (örn. 7 gün).
- Token telefonda `expo-secure-store` ile saklanır, AsyncStorage kullanılmaz.
- Giriş, kayıt ve kod girme işlemlerine **deneme sınırı** (rate limit) konur.
- Davet kodları ve devir kodları **tek kullanımlıktır**; kullanılınca geçersiz olur. Devir kodu 24 saat sonra da geçersiz olur.

### Gerçek zamanlı bağlantı
- Socket.io bağlantısı token ile doğrulanır. Token'sız veya geçersiz token'lı bağlantı reddedilir.
- Kullanıcı sadece kendi sitesinin ve kendi konuşmalarının odasına katılabilir.

### Genel
- Kullanıcıdan gelen her veri şema ile doğrulanır (boş alan, geçersiz ay, aşırı uzun metin vb.).
- MongoDB sorgu enjeksiyonuna karşı gelen veri temizlenir.
- Express'te `helmet` ve uygun CORS ayarı kullanılır.
- `.env` dosyasını okuma, gösterme, commit'leme. Veritabanı bağlantısı ve JWT anahtarı `.env` içinde durur.
- Hesap silindiğinde kullanıcının kişisel verileri silinir; aidat kayıtları gibi site için gerekli kayıtlar kişiyle bağlantısı kaldırılarak tutulur.

---

## Görevler (Slice Slice Çalışma)

Proje küçük, uçtan uca görevlere bölünmüştür. Görev listesi ve "Mevcut görev" bilgisi ayrı dosyadadır:

@GOREVLER.md

Her görev şu sırayla yapılır:
1. **Başlamadan önce:** Görevi en fazla 5 satırda özetle ve değişecek dosyaları listele.
2. **Backend:** Görevin gerektirdiği model ve route'lar.
3. **Mobil:** Görevin ekranları ve backend bağlantısı.
4. **Açıklama yazarı → Kod denetçisi:** Önemli her kod bloğundan sonra önce açıklama yazarı, ardından kod denetçisi çağrılır (bkz. Subagent'lar).
5. **Deneme:** Kullanıcıya görevin "Deneme" maddesini telefonda/emülatörde nasıl deneyeceğini anlat.
6. **Bitiş:** GOREVLER.md'de kutuyu `[x]` yap, "Mevcut görev" satırını güncelle, README'yi gerekiyorsa güncelle, commit mesajı öner.

Kullanıcı denemeyi onaylamadan bir sonraki göreve geçme.

---

## Çalışma Ortamı

- **Ücretsiz araçlarla** çalışılır. Ücret gerektiren bir servis veya hesap önerme.
- Backend geliştiricinin bilgisayarında çalışır. Veritabanı MongoDB Atlas'ın ücretsiz planındadır.
- Mobil uygulamanın backend adresi koda gömülmez; tek bir ayar dosyasından okunur. Böylece bilgisayarın yerel IP'si değişince veya ileride sunucuya taşınınca tek yerden değiştirilir.
- Telefon ve bilgisayar aynı Wi-Fi ağında olmalıdır.
- Push bildirim gibi Expo Go'da çalışmayan özellikler için Android Studio ile yerel geliştirme sürümü (`npx expo run:android`) kullanılır.

---

## GitHub

Proje GitHub'a yüklenir. Bu yüzden:

- **`.gitignore`** projenin en başında oluşturulur: `node_modules/`, `.env`, `.env.*` (`.env.example` hariç), `.expo/`, `android/`, `ios/` ve build çıktıları.
- **Gizli bilgiler asla repoya girmez:** MongoDB bağlantı adresi, JWT anahtarı, şifreler. Bir dosyaya gizli bilgi yazılmışsa commit'ten önce kullanıcıyı uyar.
- Her `.env` dosyasının yanında, değerleri boş bırakılmış bir **`.env.example`** bulunur. Projeyi indiren kişi hangi ayarları doldurması gerektiğini buradan görür.
- Kök dizinde bir **`README.md`** bulunur ve görevler ilerledikçe güncel tutulur: proje ne yapar, özellikler, kullanılan teknolojiler, kurulum ve çalıştırma adımları (backend ve mobil ayrı ayrı), ekran görüntüleri.
- Projeyi GitHub'dan indiren biri README'deki adımlarla, kendi `.env` dosyasını doldurarak projeyi kendi bilgisayarında çalıştırabilmelidir.
- Her görev bitince anlamlı, Türkçe bir commit mesajı öner (örn. `Aidat onaylama sistemi eklendi`). Commit ve push işlemini kullanıcı onay vermeden yapma.

---

## Çalışma Şekli

- Görevleri GOREVLER.md'deki sırayla, "Görevler" bölümündeki akışla yap.
- Kullanıcı bir şey kurmanı veya komut çalıştırmanı istemedikçe kurulum yapma, önce sor.
- Kullanıcıyla Türkçe konuş, sade anlat.

## Açıklama Yazarı (Subagent)

`.claude/agents/aciklama-yazari.md` dosyasındaki **aciklama-yazari** subagent'ı, önemli bir kod bloğu yazıldıktan sonra **kod denetçisinden önce** çağrılır.

- Ana asistan kodu yazarken temel açıklamaları yine kendisi yazar; açıklama yazarı bunları "Kod Açıklamaları" kuralına göre tamamlar ve iyileştirir.
- Sadece açıklama satırı ekler/düzeltir, **koda asla dokunmaz.** Fark ettiği kod hatalarını raporlar.
- Çağırırken hangi dosyaların yazıldığını söyle. Ne zaman çağrılacağı kod denetçisiyle aynıdır (önemli / önemsiz değişiklik tanımı aşağıda).

## Kod Denetçisi (Subagent)

`.claude/agents/kod-denetcisi.md` dosyasındaki **kod-denetcisi** subagent'ı projenin başından sonuna kadar kullanılır.

- Sürekli çalışmaz. **Önemli bir kod bloğu yazıldıktan hemen sonra** Agent aracıyla çağrılır, sadece o kodu inceler, raporunu verir ve kapanır. Bir sonraki önemli kod bloğuna kadar çağrılmaz.
- **Önemli kod bloğu:** yeni bir dosya, yeni bir ekran veya component, yeni bir API route'u, yeni veya değişen bir veri modeli, giriş/yetki kodu, socket veya bildirim kodu, birden fazla dosyayı etkileyen bir değişiklik.
- **Önemsiz değişiklik (çağrılmaz):** yazım düzeltmesi, renk/boşluk gibi stil ayarı, tek satırlık küçük değişiklik, sadece açıklama satırı ekleme.
- Çağırırken denetçiye **hangi dosyaların ve hangi kodun** yazıldığını söyle. Tüm projeyi taratma.
- Denetçinin 🔴 Kritik bulgularını bir sonraki koda geçmeden düzelt. 🟡 ve 🟢 bulguları kullanıcıya kısaca bildir.

## Görev Bitince Rapor

Sadece şunları yaz:
- **Ne yapıldı:** değişen dosyalar ve eklenen özellik
- **Nasıl denenir:** kullanıcının uygulamada neye basıp ne görmesi gerektiği
- **Dikkat:** varsa bilinen sorun veya eksik
- **Sıradaki görev**
