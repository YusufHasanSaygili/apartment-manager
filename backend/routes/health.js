// Sağlık kontrolü route'u: mobil uygulamanın "sunucuya ulaşabiliyor muyum?" diye
// sorduğu uç. Giriş gerektirmez, herkes kullanabilir; site verisi döndürmediği için
// güvenlik riski yoktur.
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /api/health
// Sunucunun çalıştığını ve veritabanı bağlantısının durumunu döner.
// readyState === 1 → Mongoose şu an MongoDB'ye bağlı demektir.
router.get('/', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  // Veritabanı yoksa 503 (hizmet kullanılamıyor) döneriz; böylece mobil taraf
  // "sunucu açık ama veritabanı yok" durumunu da ayırt edebilir.
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'no-database',
    database: databaseConnected,
    // Hata durumunda mobilin ortak hata gösterimi bu mesajı kullanır.
    ...(databaseConnected ? {} : { message: 'Sunucu açık ama veritabanına bağlanamadı.' }),
    time: new Date().toISOString(),
  });
});

module.exports = router;
