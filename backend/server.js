// Sunucunun başladığı dosya: Express uygulamasını kurar, route'ları bağlar,
// MongoDB Atlas'a bağlanır ve gelen istekleri dinlemeye başlar.
// Ayarlar (.env) "node --env-file=.env" ile yüklenir, ekstra kütüphane gerekmez.
const dns = require('node:dns');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const saglikRoute = require('./routes/saglik');
const hesapRoute = require('./routes/hesap');
const kurulumRoute = require('./routes/kurulum');
const dairelerRoute = require('./routes/daireler');
const aidatlarRoute = require('./routes/aidatlar');
const aidatYonetimRoute = require('./routes/aidatYonetim');
const duyurularRoute = require('./routes/duyurular');
const mesajlarRoute = require('./routes/mesajlar');
const { genelSinir } = require('./middleware/denemeSiniri');
const temizle = require('./middleware/temizle');
const { bulunamadi, hataYakalayici } = require('./middleware/hataYonetimi');

// Bazı bilgisayarlarda Node.js'in kullandığı yerel DNS, MongoDB Atlas'ın "mongodb+srv"
// kaydını çözemez (hata: querySrv ECONNREFUSED). .env'de DNS_SUNUCULARI verilirse
// Node bu DNS sunucularını kullanır; verilmezse sistemin varsayılanı kullanılır.
if (process.env.DNS_SUNUCULARI) {
  dns.setServers(process.env.DNS_SUNUCULARI.split(',').map((s) => s.trim()));
}

// Ayarlar .env dosyasından okunur; gizli bilgiler (veritabanı adresi) koda yazılmaz.
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// CORS: tarayıcıdan hangi web sitelerinin bu API'yi çağırabileceğini belirler.
// Mobil uygulama CORS'tan etkilenmez; varsayılan olarak hiçbir web sitesine izin verilmez.
// İleride bir web paneli eklenirse adresi .env'deki CORS_IZINLI_ADRESLER'e yazılır.
const CORS_IZINLI_ADRESLER = (process.env.CORS_IZINLI_ADRESLER || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();

// Güvenlik middleware'leri: her istek route'a ulaşmadan önce sırayla bunlardan geçer.
// helmet: tarayıcı saldırılarına karşı güvenlik başlıkları ekler, "X-Powered-By: Express"
// bilgisini gizler (saldırgan hangi teknolojiyi kullandığımızı öğrenemez).
app.use(helmet());
// origin: false → hiçbir web sitesine izin yok (liste boşsa).
app.use(cors({ origin: CORS_IZINLI_ADRESLER.length > 0 ? CORS_IZINLI_ADRESLER : false }));
// Deneme sınırı: aynı IP'den çok fazla istek gelirse 429 hatası döner.
// JSON okumadan ÖNCE konur; böylece sınırı aşan isteklerin gövdesi hiç işlenmez, sunucu yorulmaz.
app.use('/api', genelSinir);

// Gelen isteklerdeki JSON gövdesini okuyup req.body'ye koyar.
// limit: aşırı büyük isteklerle sunucunun yorulmasını önler.
app.use(express.json({ limit: '100kb' }));
// JSON okunduktan sonra içindeki "$" ile başlayan tehlikeli anahtarları siler.
app.use(temizle);

// Route'lar: her özellik kendi dosyasında, burada sadece adrese bağlanır.
app.use('/api/saglik', saglikRoute);
app.use('/api/hesap', hesapRoute);
app.use('/api/kurulum', kurulumRoute); // bina/daire kurulumu ve aidat tutarı: sadece giriş yapmış yönetici
app.use('/api/daireler', dairelerRoute); // sadece giriş yapmış yönetici
app.use('/api/aidatlar', aidatlarRoute); // sadece giriş yapmış sakin: aidat bildirimi ve kendi geçmişi
app.use('/api/yonetim/aidatlar', aidatYonetimRoute); // sadece yönetici: bildirim onay/red, harita, takvim, elle işaretleme
app.use('/api/duyurular', duyurularRoute); // listeleme herkes, yazma/silme sadece yönetici
app.use('/api/mesajlar', mesajlarRoute); // giriş yapmış herkes: yönetici ↔ kendi sitesinin sakinleri arasında yazışma

// Hiçbir route'a uymayan istekler 404'e, tüm hatalar merkezi hata yakalayıcıya gider.
// Bu ikisi route'lardan SONRA eklenmelidir; Express middleware'leri sırayla çalıştırır.
app.use(bulunamadi);
app.use(hataYakalayici);

// Sunucuyu başlatan fonksiyon: önce veritabanına bağlanır, sonra dinlemeye başlar.
async function baslat() {
  // Veritabanı adresi yoksa sunucu hiç açılmaz; aksi halde veritabanısız çalışıp
  // her istekte anlaşılmaz hatalar verirdi. Sorun en başta açıkça söylenir.
  // JWT_ANAHTARI da zorunlu: token'lar bu gizli anahtarla imzalanır; yoksa kayıt/giriş çalışamaz.
  if (!MONGODB_URI || !process.env.JWT_ANAHTARI) {
    console.error('MONGODB_URI veya JWT_ANAHTARI tanımlı değil. backend/.env dosyasını kontrol edin.');
    process.exit(1);
  }

  try {
    // MongoDB Atlas bağlantısı. Bağlantı adresi loglanmaz çünkü içinde şifre var.
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB bağlantısı kuruldu');
  } catch (hata) {
    console.error('MongoDB bağlantısı kurulamadı:', hata.message);
    process.exit(1);
  }

  // '0.0.0.0': sadece bu bilgisayardan değil, aynı Wi-Fi'deki telefondan da
  // gelen istekleri kabul etmek için tüm ağ arayüzlerini dinler.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
  });
}

baslat();
