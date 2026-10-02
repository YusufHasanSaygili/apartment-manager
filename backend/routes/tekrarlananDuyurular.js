// Tekrarlayan duyuru route'ları: yönetici belirli gün(ler) ve saatte kendiliğinden yayınlanacak
// duyuruları ekler, listeler ve siler. Yayınlama işini services/tekrarlananDuyuru.js yapar.
const express = require('express');
const { z } = require('zod');
const TekrarlananDuyuru = require('../models/TekrarlananDuyuru');
const dogrula = require('../middleware/dogrula');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');

const router = express.Router();

// Bu dosyadaki tüm route'lar sadece giriş yapmış YÖNETİCİ içindir. siteId her zaman token'dan alınır:
// yönetici sadece kendi sitesinin tekrarlayan duyurularını görür, ekler ve siler.
router.use(girisGerekli, sadeceYonetici);

// Bir sitede en fazla bu kadar tekrarlayan duyuru olabilir (her dakika çalışan görev aşırı yüklenmesin diye).
const EN_FAZLA = 20;

// Ekranda gösterilecek biçim: veritabanı alan adları (_id) yerine sade alanlar.
const bicim = (t) => ({
  id: t._id,
  baslik: t.baslik,
  icerik: t.icerik,
  gunler: t.gunler,
  saat: t.saat,
  dakika: t.dakika,
  sonGonderim: t.sonGonderim,
});

// GET /api/tekrarlanan-duyurular
// Kim kullanabilir: yönetici. Kendi sitesinin tekrarlayan duyurularını saate göre sıralı döner.
router.get('/', async (req, res) => {
  const liste = await TekrarlananDuyuru.find({ siteId: req.kullanici.siteId }).sort({ saat: 1, dakika: 1 }).lean();
  res.json(liste.map(bicim));
});

// Ekleme formunun kuralları: boş başlık/içerik, geçersiz gün veya saat kabul edilmez.
// gunler: 0 (Pazar) – 6 (Cumartesi) arası en az bir gün. Aynı gün iki kez seçilirse Set ile tekrarlar atılır ve sıralanır.
const tekrarlananSemasi = z.object({
  baslik: z.string({ error: 'Başlık girilmeli' }).trim().min(2, 'Başlık en az 2 karakter olmalı').max(80, 'Başlık en fazla 80 karakter olabilir'),
  icerik: z.string({ error: 'İçerik girilmeli' }).trim().min(1, 'İçerik girilmeli').max(1000, 'İçerik en fazla 1000 karakter olabilir'),
  gunler: z
    .array(z.number().int().min(0, 'Gün geçersiz').max(6, 'Gün geçersiz'), { error: 'Gün seçilmeli' })
    .min(1, 'En az bir gün seçilmeli')
    .max(7, 'Gün geçersiz')
    .transform((g) => [...new Set(g)].sort()),
  saat: z.number({ error: 'Saat girilmeli' }).int().min(0, 'Saat geçersiz').max(23, 'Saat geçersiz'),
  dakika: z.number({ error: 'Dakika girilmeli' }).int().min(0, 'Dakika geçersiz').max(59, 'Dakika geçersiz'),
});

// POST /api/tekrarlanan-duyurular
// Kim kullanabilir: yönetici. Kendi sitesine yeni bir tekrarlayan duyuru ekler (siteId token'dan).
// Sitede zaten EN_FAZLA kadar varsa 400 döner.
router.post('/', dogrula(tekrarlananSemasi), async (req, res) => {
  const { siteId } = req.kullanici;
  const adet = await TekrarlananDuyuru.countDocuments({ siteId });
  if (adet >= EN_FAZLA) {
    throw new ApiHatasi(400, `En fazla ${EN_FAZLA} tekrarlayan duyuru eklenebilir.`);
  }
  const yeni = await TekrarlananDuyuru.create({ siteId, ...req.body });
  res.status(201).json(bicim(yeni));
});

// DELETE /api/tekrarlanan-duyurular/:id
// Kim kullanabilir: yönetici. Kendi sitesindeki bir tekrarlayan duyuruyu siler; bundan sonra yayınlanmaz.
// (Daha önce yayınlanmış duyurular listede kalır.) Sorguda siteId olduğu için başka sitenin kaydı
// silinemez; bulunamazsa veya id geçersizse 404.
router.delete('/:id', async (req, res) => {
  const sonuc = await TekrarlananDuyuru.deleteOne({ _id: req.params.id, siteId: req.kullanici.siteId });
  if (sonuc.deletedCount === 0) throw new ApiHatasi(404, 'Tekrarlayan duyuru bulunamadı.');
  res.status(204).end();
});

module.exports = router;
