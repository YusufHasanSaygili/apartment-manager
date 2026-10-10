// Sunucunun başladığı dosya: Express uygulamasını kurar, route'ları bağlar,
// MongoDB Atlas'a bağlanır ve gelen istekleri dinlemeye başlar.
// Ayarlar (.env) "node --env-file=.env" ile yüklenir, ekstra kütüphane gerekmez.
const dns = require('node:dns');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const healthRoute = require('./routes/health');
const accountRoute = require('./routes/account');
const setupRoute = require('./routes/setup');
const flatsRoute = require('./routes/flats');
const duesRoute = require('./routes/dues');
const dueManagementRoute = require('./routes/dueManagement');
const announcementsRoute = require('./routes/announcements');
const messagesRoute = require('./routes/messages');
const recurringAnnouncementsRoute = require('./routes/recurringAnnouncements');
const handoverRoute = require('./routes/handover');
const { generalLimiter } = require('./middleware/rateLimits');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { startSocket } = require('./socket');
const { scheduleReminders } = require('./services/reminders');
const { scheduleRecurringAnnouncements } = require('./services/recurringAnnouncements');

// Bazı bilgisayarlarda Node.js'in kullandığı yerel DNS, MongoDB Atlas'ın "mongodb+srv"
// kaydını çözemez (hata: querySrv ECONNREFUSED). .env'de DNS_SERVERS verilirse
// Node bu DNS sunucularını kullanır; verilmezse sistemin varsayılanı kullanılır.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

// Ayarlar .env dosyasından okunur; gizli bilgiler (veritabanı adresi) koda yazılmaz.
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// CORS: tarayıcıdan hangi web sitelerinin bu API'yi çağırabileceğini belirler.
// Mobil uygulama CORS'tan etkilenmez; varsayılan olarak hiçbir web sitesine izin verilmez.
// İleride bir web paneli eklenirse adresi .env'deki CORS_ALLOWED_ORIGINS'e yazılır.
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();

// Güvenlik middleware'leri: her istek route'a ulaşmadan önce sırayla bunlardan geçer.
// helmet: tarayıcı saldırılarına karşı güvenlik başlıkları ekler, "X-Powered-By: Express"
// bilgisini gizler (saldırgan hangi teknolojiyi kullandığımızı öğrenemez).
app.use(helmet());
// origin: false → hiçbir web sitesine izin yok (liste boşsa).
app.use(cors({ origin: CORS_ALLOWED_ORIGINS.length > 0 ? CORS_ALLOWED_ORIGINS : false }));
// Deneme sınırı: aynı IP'den çok fazla istek gelirse 429 hatası döner.
// JSON okumadan ÖNCE konur; böylece sınırı aşan isteklerin gövdesi hiç işlenmez, sunucu yorulmaz.
app.use('/api', generalLimiter);

// Gelen isteklerdeki JSON gövdesini okuyup req.body'ye koyar.
// limit: aşırı büyük isteklerle sunucunun yorulmasını önler.
app.use(express.json({ limit: '100kb' }));
// JSON okunduktan sonra içindeki "$" ile başlayan tehlikeli anahtarları siler.
app.use(sanitize);

// Route'lar: her özellik kendi dosyasında, burada sadece adrese bağlanır.
app.use('/api/health', healthRoute);
app.use('/api/account', accountRoute);
app.use('/api/setup', setupRoute); // bina/daire kurulumu ve aidat tutarı: sadece giriş yapmış yönetici
app.use('/api/flats', flatsRoute); // sadece giriş yapmış yönetici
app.use('/api/dues', duesRoute); // sadece giriş yapmış sakin: aidat bildirimi ve kendi geçmişi
app.use('/api/manager/dues', dueManagementRoute); // sadece yönetici: bildirim onay/red, harita, takvim, elle işaretleme
app.use('/api/announcements', announcementsRoute); // listeleme herkes, yazma/silme sadece yönetici
app.use('/api/recurring-announcements', recurringAnnouncementsRoute); // sadece yönetici: tekrarlayan duyuru ekleme, listeleme, silme
app.use('/api/messages', messagesRoute); // giriş yapmış herkes: yönetici ↔ kendi sitesinin sakinleri arasında yazışma
app.use('/api/handover', handoverRoute); // sadece yönetici: yöneticiliği bir dairenin sakinine devretme

// Hiçbir route'a uymayan istekler 404'e, tüm hatalar merkezi hata yakalayıcıya gider.
// Bu ikisi route'lardan SONRA eklenmelidir; Express middleware'leri sırayla çalıştırır.
app.use(notFound);
app.use(errorHandler);

// Sunucuyu başlatan fonksiyon: önce veritabanına bağlanır, sonra dinlemeye başlar.
async function start() {
  // Veritabanı adresi yoksa sunucu hiç açılmaz; aksi halde veritabanısız çalışıp
  // her istekte anlaşılmaz hatalar verirdi. Sorun en başta açıkça söylenir.
  // JWT_SECRET da zorunlu: token'lar bu gizli anahtarla imzalanır; yoksa kayıt/giriş çalışamaz.
  if (!MONGODB_URI || !process.env.JWT_SECRET) {
    console.error('MONGODB_URI veya JWT_SECRET tanımlı değil. backend/.env dosyasını kontrol edin.');
    process.exit(1);
  }

  try {
    // MongoDB Atlas bağlantısı. Bağlantı adresi loglanmaz çünkü içinde şifre var.
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB bağlantısı kuruldu');
  } catch (error) {
    console.error('MongoDB bağlantısı kurulamadı:', error.message);
    process.exit(1);
  }

  // HTTP sunucusu elle oluşturulur: hem Express (API) hem Socket.io (anlık mesaj) aynı portu kullanır.
  const server = http.createServer(app);
  startSocket(server, CORS_ALLOWED_ORIGINS);

  // '0.0.0.0': sadece bu bilgisayardan değil, aynı Wi-Fi'deki telefondan da
  // gelen istekleri kabul etmek için tüm ağ arayüzlerini dinler.
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
  });

  // Otomatik görevler: her ayın 10'unda ödemeyen sakinlere aidat hatırlatması (services/reminders.js)
  // ve her dakika zamanı gelen tekrarlayan duyuruların yayınlanması (services/recurringAnnouncements.js).
  // Veritabanı bağlantısından SONRA kurulur; görevler çalışınca veritabanına erişebilmelidir.
  scheduleReminders();
  scheduleRecurringAnnouncements();
}

start();
