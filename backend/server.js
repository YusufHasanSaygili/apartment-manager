// Sunucunun başladığı dosya: Express uygulamasını kurar, route'ları bağlar,
// MongoDB Atlas'a bağlanır ve gelen istekleri dinlemeye başlar.
// Ayarlar (.env) "node --env-file=.env" ile yüklenir, ekstra kütüphane gerekmez.
const dns = require('node:dns');
const express = require('express');
const mongoose = require('mongoose');
const saglikRoute = require('./routes/saglik');

// Bazı bilgisayarlarda Node.js'in kullandığı yerel DNS, MongoDB Atlas'ın "mongodb+srv"
// kaydını çözemez (hata: querySrv ECONNREFUSED). .env'de DNS_SUNUCULARI verilirse
// Node bu DNS sunucularını kullanır; verilmezse sistemin varsayılanı kullanılır.
if (process.env.DNS_SUNUCULARI) {
  dns.setServers(process.env.DNS_SUNUCULARI.split(',').map((s) => s.trim()));
}

// Ayarlar .env dosyasından okunur; gizli bilgiler (veritabanı adresi) koda yazılmaz.
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const app = express();

// Gelen isteklerdeki JSON gövdesini okuyup req.body'ye koyar.
// limit: aşırı büyük isteklerle sunucunun yorulmasını önler.
app.use(express.json({ limit: '100kb' }));

// Route'lar: her özellik kendi dosyasında, burada sadece adrese bağlanır.
app.use('/api/saglik', saglikRoute);

// Tanımlı olmayan bir adrese istek gelirse düzgün bir 404 cevabı döner.
app.use((req, res) => {
  res.status(404).json({ mesaj: 'Bulunamadı' });
});

// Sunucuyu başlatan fonksiyon: önce veritabanına bağlanır, sonra dinlemeye başlar.
async function baslat() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI tanımlı değil. backend/.env dosyasını kontrol edin.');
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
