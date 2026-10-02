// Duyuru route'ları: herkes kendi sitesinin duyurularını görür; sadece yönetici duyuru yapar, düzenler ve siler.
const express = require('express');
const { z } = require('zod');
const Duyuru = require('../models/Duyuru');
const Kullanici = require('../models/Kullanici');
const { pushGonder } = require('../services/bildirim');
const dogrula = require('../middleware/dogrula');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');

const router = express.Router();

// Tüm duyuru route'ları giriş gerektirir. siteId her zaman req.kullanici'dan (token) alınır:
// kimse başka bir sitenin duyurusunu göremez, yapamaz veya silemez.
router.use(girisGerekli);

// Duyuru formunun kuralları: boş başlık/içerik ve aşırı uzun metin kabul edilmez.
const duyuruSemasi = z.object({
  baslik: z.string({ error: 'Başlık girilmeli' }).trim().min(2, 'Başlık en az 2 karakter olmalı').max(80, 'Başlık en fazla 80 karakter olabilir'),
  icerik: z.string({ error: 'İçerik girilmeli' }).trim().min(1, 'İçerik girilmeli').max(1000, 'İçerik en fazla 1000 karakter olabilir'),
});

// GET /api/duyurular
// Kim kullanabilir: giriş yapmış herkes (yönetici ve sakin). Kendi sitesinin duyurularını
// yeniden eskiye, en fazla son 50 tane olarak döner.
router.get('/', async (req, res) => {
  const duyurular = await Duyuru.find({ siteId: req.kullanici.siteId }).sort({ tarih: -1 }).limit(50).lean();
  res.json(duyurular.map((d) => ({ id: d._id, baslik: d.baslik, icerik: d.icerik, tarih: d.tarih })));
});

// POST /api/duyurular
// Kim kullanabilir: sadece yönetici. Kendi sitesine yeni duyuru yapar ve sitedeki herkesin
// telefonuna push bildirim gönderir (duyuruyu yapan yönetici hariç).
router.post('/', sadeceYonetici, dogrula(duyuruSemasi), async (req, res) => {
  const { siteId, id } = req.kullanici;
  const duyuru = await Duyuru.create({ siteId, ...req.body });
  res.status(201).json({ id: duyuru._id, baslik: duyuru.baslik, icerik: duyuru.icerik, tarih: duyuru.tarih });

  // Bildirim cevaptan SONRA gönderilir: yönetici bildirimlerin gitmesini beklemez.
  // Sadece aynı sitedeki ve push token'ı olan kullanıcılara gider (site izolasyonu).
  // veri.ekran: bildirime dokununca hangi ekranın açılacağı bilgisi (mobil tarafta henüz okunmuyor).
  // Cevap zaten gittiği için buradaki hatalar kullanıcıya iletilemez; sadece sunucu konsoluna yazılır.
  try {
    const alicilar = await Kullanici.find({ siteId, _id: { $ne: id }, pushToken: { $ne: null } }).select('pushToken').lean();
    await pushGonder(
      alicilar.map((k) => k.pushToken),
      { baslik: `Duyuru: ${duyuru.baslik}`, icerik: duyuru.icerik, veri: { ekran: 'Duyurular' } }
    );
  } catch (hata) {
    console.error('Duyuru bildirimi gönderilemedi:', hata.message);
  }
});

// PUT /api/duyurular/:id
// Kim kullanabilir: sadece yönetici. Kendi sitesindeki bir duyurunun başlığını ve içeriğini düzeltir.
// Sorguda siteId de olduğu için başka sitenin duyurusu değiştirilemez; bulunamazsa 404.
// returnDocument: 'after' → güncellenmiş hali döner.
router.put('/:id', sadeceYonetici, dogrula(duyuruSemasi), async (req, res) => {
  const duyuru = await Duyuru.findOneAndUpdate(
    { _id: req.params.id, siteId: req.kullanici.siteId },
    { baslik: req.body.baslik, icerik: req.body.icerik },
    { returnDocument: 'after' }
  );
  if (!duyuru) throw new ApiHatasi(404, 'Duyuru bulunamadı.');
  res.json({ id: duyuru._id, baslik: duyuru.baslik, icerik: duyuru.icerik, tarih: duyuru.tarih });
});

// DELETE /api/duyurular/:id
// Kim kullanabilir: sadece yönetici. Kendi sitesindeki bir duyuruyu siler (örn. yanlış yazıldıysa).
// Sorguda siteId de olduğu için başka sitenin duyurusu silinemez; bulunamazsa 404.
router.delete('/:id', sadeceYonetici, async (req, res) => {
  const sonuc = await Duyuru.deleteOne({ _id: req.params.id, siteId: req.kullanici.siteId });
  if (sonuc.deletedCount === 0) throw new ApiHatasi(404, 'Duyuru bulunamadı.');
  res.status(204).end(); // 204: başarılı, gönderilecek içerik yok
});

module.exports = router;
