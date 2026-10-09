// Duyuru route'ları: herkes kendi sitesinin duyurularını görür; sadece yönetici duyuru yapar, düzenler ve siler.
const express = require('express');
const { z } = require('zod');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendPush } = require('../services/pushNotifications');
const validate = require('../middleware/validate');
const { requireAuth, managerOnly } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// Tüm duyuru route'ları giriş gerektirir. siteId her zaman req.kullanici'dan (token) alınır:
// kimse başka bir sitenin duyurusunu göremez, yapamaz veya silemez.
router.use(requireAuth);

// Duyuru formunun kuralları: boş başlık/içerik ve aşırı uzun metin kabul edilmez.
const announcementSchema = z.object({
  baslik: z.string({ error: 'Başlık girilmeli' }).trim().min(2, 'Başlık en az 2 karakter olmalı').max(80, 'Başlık en fazla 80 karakter olabilir'),
  icerik: z.string({ error: 'İçerik girilmeli' }).trim().min(1, 'İçerik girilmeli').max(1000, 'İçerik en fazla 1000 karakter olabilir'),
});

// GET /api/duyurular
// Kim kullanabilir: giriş yapmış herkes (yönetici ve sakin). Kendi sitesinin duyurularını
// yeniden eskiye, en fazla son 50 tane olarak döner.
router.get('/', async (req, res) => {
  const announcements = await Announcement.find({ siteId: req.kullanici.siteId }).sort({ tarih: -1 }).limit(50).lean();
  res.json(announcements.map((d) => ({ id: d._id, baslik: d.baslik, icerik: d.icerik, tarih: d.tarih })));
});

// POST /api/duyurular
// Kim kullanabilir: sadece yönetici. Kendi sitesine yeni duyuru yapar ve sitedeki herkesin
// telefonuna push bildirim gönderir (duyuruyu yapan yönetici hariç).
router.post('/', managerOnly, validate(announcementSchema), async (req, res) => {
  const { siteId, id } = req.kullanici;
  const announcement = await Announcement.create({ siteId, ...req.body });
  res.status(201).json({ id: announcement._id, baslik: announcement.baslik, icerik: announcement.icerik, tarih: announcement.tarih });

  // Bildirim cevaptan SONRA gönderilir: yönetici bildirimlerin gitmesini beklemez.
  // Sadece aynı sitedeki ve push token'ı olan kullanıcılara gider (site izolasyonu).
  // pushData.ekran: bildirime dokununca hangi ekranın açılacağı bilgisi (mobil tarafta henüz okunmuyor).
  // Cevap zaten gittiği için buradaki hatalar kullanıcıya iletilemez; sadece sunucu konsoluna yazılır.
  try {
    const recipients = await User.find({ siteId, _id: { $ne: id }, pushToken: { $ne: null } }).select('pushToken').lean();
    await sendPush(
      recipients.map((k) => k.pushToken),
      { baslik: `Duyuru: ${announcement.baslik}`, icerik: announcement.icerik, pushData: { ekran: 'Duyurular' } }
    );
  } catch (error) {
    console.error('Duyuru bildirimi gönderilemedi:', error.message);
  }
});

// PUT /api/duyurular/:id
// Kim kullanabilir: sadece yönetici. Kendi sitesindeki bir duyurunun başlığını ve içeriğini düzeltir.
// Sorguda siteId de olduğu için başka sitenin duyurusu değiştirilemez; bulunamazsa 404.
// returnDocument: 'after' → güncellenmiş hali döner.
router.put('/:id', managerOnly, validate(announcementSchema), async (req, res) => {
  const announcement = await Announcement.findOneAndUpdate(
    { _id: req.params.id, siteId: req.kullanici.siteId },
    { baslik: req.body.baslik, icerik: req.body.icerik },
    { returnDocument: 'after' }
  );
  if (!announcement) throw new ApiError(404, 'Duyuru bulunamadı.');
  res.json({ id: announcement._id, baslik: announcement.baslik, icerik: announcement.icerik, tarih: announcement.tarih });
});

// DELETE /api/duyurular/:id
// Kim kullanabilir: sadece yönetici. Kendi sitesindeki bir duyuruyu siler (örn. yanlış yazıldıysa).
// Sorguda siteId de olduğu için başka sitenin duyurusu silinemez; bulunamazsa 404.
router.delete('/:id', managerOnly, async (req, res) => {
  const result = await Announcement.deleteOne({ _id: req.params.id, siteId: req.kullanici.siteId });
  if (result.deletedCount === 0) throw new ApiError(404, 'Duyuru bulunamadı.');
  res.status(204).end(); // 204: başarılı, gönderilecek içerik yok
});

module.exports = router;
