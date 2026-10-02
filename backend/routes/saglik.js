// Sağlık kontrolü route'u: mobil uygulamanın "sunucuya ulaşabiliyor muyum?" diye
// sorduğu uç. Giriş gerektirmez, herkes kullanabilir; site verisi döndürmediği için
// güvenlik riski yoktur.
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /api/saglik
// Sunucunun çalıştığını ve veritabanı bağlantısının durumunu döner.
// readyState === 1 → Mongoose şu an MongoDB'ye bağlı demektir.
router.get('/', (req, res) => {
  const veritabaniBagli = mongoose.connection.readyState === 1;

  // Veritabanı yoksa 503 (hizmet kullanılamıyor) döneriz; böylece mobil taraf
  // "sunucu açık ama veritabanı yok" durumunu da ayırt edebilir.
  res.status(veritabaniBagli ? 200 : 503).json({
    durum: veritabaniBagli ? 'ok' : 'veritabani-yok',
    veritabani: veritabaniBagli,
    zaman: new Date().toISOString(),
  });
});

module.exports = router;
