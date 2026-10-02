// Aidat route'ları (sakin tarafı): "aidatı verdim" bildirimi gönderme ve kendi geçmişini görme.
const express = require('express');
const { z } = require('zod');
const Aidat = require('../models/Aidat');
const Site = require('../models/Site');
const Kullanici = require('../models/Kullanici');
const dogrula = require('../middleware/dogrula');
const { tutarKurali } = require('../middleware/dogrula');
const { girisGerekli, sadeceSakin } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');

const router = express.Router();

// Bu dosyadaki route'lar sadece giriş yapmış ve bir daireye bağlı SAKİN içindir.
// siteId ve daireId her zaman req.kullanici'dan alınır: sakin sadece KENDİ dairesi adına
// bildirim gönderebilir ve sadece kendi dairesinin geçmişini görebilir.
router.use(girisGerekli, sadeceSakin);

// Bir ayın "son 12 ay" içinde olup olmadığını kontrol eder (gelecek aylar ve çok eski aylar reddedilir).
// Ay sırası = yıl × 12 + ay: iki tarihi tek bir sayıyla karşılaştırmayı kolaylaştırır.
function son12AyIcinde(ay, yil) {
  const simdi = new Date();
  const buAy = simdi.getFullYear() * 12 + simdi.getMonth() + 1;
  const secilen = yil * 12 + ay;
  return secilen <= buAy && secilen > buAy - 12;
}

// Bildirim formunun kuralları.
const bildirimSemasi = z.object({
  ay: z.number({ error: 'Ay seçilmeli' }).int().min(1, 'Geçersiz ay').max(12, 'Geçersiz ay'),
  yil: z.number({ error: 'Yıl seçilmeli' }).int(),
  tutar: tutarKurali, // 0'dan büyük, en fazla 99.999,99 TL, en fazla 2 kuruş basamağı
  odemeYontemi: z.enum(['banka', 'elden'], { error: 'Ödeme yöntemi seçilmeli' }),
  aciklama: z.string().trim().max(200, 'Açıklama en fazla 200 karakter olabilir').default(''),
});

// GET /api/aidatlar/takvim?yil=2026
// Kim kullanabilir: sakin. KENDİ dairesinin seçilen yıldaki 12 ayının aidat durumunu döner.
// daireId istekten değil token'dan gelir: sakin başka dairenin takvimini göremez.
const yilSemasi = z.object({
  yil: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});
router.get('/takvim', dogrula(yilSemasi, 'query'), async (req, res) => {
  const { id, siteId, daireId } = req.kullanici;
  // Sakinin hesap açma tarihi: katıldığı aydan önceki aylar takvimde gri ("Sakin yok") görünür.
  const sakin = await Kullanici.findById(id).select('createdAt').lean();
  res.json({ aylar: await Aidat.yillikTakvim(siteId, daireId, req.query.yil, sakin?.createdAt ?? null) });
});

// GET /api/aidatlar/benim
// Kim kullanabilir: sakin. Sitenin aylık aidat tutarını (formda hazır gelmesi için) ve
// sakinin KENDİ dairesinin bildirim geçmişini (yeniden eskiye, son 2 kayıt) döner.
// Ana ekran kısa kalsın diye sadece son 2 bildirim gönderilir; tüm aylar "Aidat takvimim" ekranında görülür.
router.get('/benim', async (req, res) => {
  const { siteId, daireId } = req.kullanici;
  // Promise.all: iki sorguyu sırayla değil AYNI ANDA çalıştırır, cevap daha hızlı döner.
  // Aidat sorgusu hem siteId hem daireId ile filtrelenir: sakin başka dairenin kaydını göremez.
  const [site, bildirimler] = await Promise.all([
    Site.findById(siteId).select('aidatTutari').lean(),
    // Sadece sakinin KENDİ gönderdiği bildirimler (yöneticinin elle işaretledikleri takvimde görünür).
    Aidat.find({ siteId, daireId, odemeYontemi: { $ne: 'yonetici' } }).sort({ tarih: -1 }).limit(2).lean(),
  ]);

  res.json({
    aidatTutari: site?.aidatTutari ?? null,
    bildirimler: bildirimler.map((a) => ({
      id: a._id,
      ay: a.ay,
      yil: a.yil,
      tutar: a.tutar,
      odemeYontemi: a.odemeYontemi,
      aciklama: a.aciklama,
      durum: a.durum,
      tarih: a.tarih,
    })),
  });
});

// POST /api/aidatlar
// Kim kullanabilir: sakin. Kendi dairesi için "aidatı verdim" bildirimi oluşturur (durum: bekliyor).
// Aynı ay için bekleyen veya onaylanmış bir bildirim varsa yenisi kabul edilmez (409).
router.post('/', dogrula(bildirimSemasi), async (req, res) => {
  const { siteId, daireId } = req.kullanici;
  const { ay, yil, tutar, odemeYontemi, aciklama } = req.body;

  if (!son12AyIcinde(ay, yil)) {
    throw new ApiHatasi(400, 'Sadece bu ay ve önceki 11 ay için bildirim gönderilebilir.');
  }

  // Reddedilen bildirimler sayılmaz: reddedilen aya tekrar bildirim gönderilebilir.
  const varMi = await Aidat.exists({ siteId, daireId, ay, yil, durum: { $in: ['bekliyor', 'onaylandi'] } });
  if (varMi) {
    throw new ApiHatasi(409, 'Bu ay için zaten bekleyen veya onaylanmış bir bildiriminiz var.');
  }

  // Math.round(... * 100) / 100: tutarı tam 2 kuruş basamağına yuvarlar (ondalık hatalarını önler).
  // İki istek aynı anda gelip yukarıdaki kontrolü birlikte geçerse, modeldeki unique index ikincisini
  // reddeder (MongoDB 11000 hatası → merkezi hata yakalayıcı 409 döner).
  const aidat = await Aidat.create({
    siteId,
    daireId,
    ay,
    yil,
    tutar: Math.round(tutar * 100) / 100,
    odemeYontemi,
    aciklama,
  });

  res.status(201).json({ id: aidat._id, durum: aidat.durum });
});

module.exports = router;
