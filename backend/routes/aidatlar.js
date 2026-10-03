// Aidat route'ları (sakin tarafı): "aidatı verdim" bildirimi gönderme ve kendi geçmişini görme.
const express = require('express');
const { z } = require('zod');
const Aidat = require('../models/Aidat');
const Site = require('../models/Site');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Kullanici = require('../models/Kullanici');
const dogrula = require('../middleware/dogrula');
const { tutarKurali } = require('../middleware/dogrula');
const { girisGerekli, sadeceSakin } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { pushGonder, ayYazisi } = require('../services/bildirim');

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
  // Sakinin daireye giriş tarihi (daireyeGiris, eski kayıtlarda hesap açma tarihi): bu aydan önceki aylar
  // takvimde gri ("Sakin yok") görünür. Devirle sakin olan eski yönetici için devir günüdür.
  const sakin = await Kullanici.findById(id).select('daireyeGiris createdAt').lean();
  const giris = Kullanici.daireyeGirisTarihi(sakin);
  const aylar = await Aidat.yillikTakvim(siteId, daireId, req.query.yil, giris);
  // Daire el değiştirdiyse önceki sakinin ödemeleri yeni sakine gösterilmez (gizlilik):
  // sakinin katıldığı aydan önceki aylar, kayıt olsa bile "bos" (gri) döner. Yönetici takviminde hepsi görünür.
  // Ay sırası = yıl × 12 + ay (Aidat.aySirasi ile aynı hesap): iki ayı tek bir < karşılaştırmasıyla kıyaslamak için.
  const katilmaSirasi = Aidat.aySirasi(giris);
  res.json({ aylar: aylar.map((a) => (req.query.yil * 12 + a.ay < katilmaSirasi ? { ay: a.ay, durum: 'bos' } : a)) });
});

// GET /api/aidatlar/benim
// Kim kullanabilir: sakin. Sitenin aylık aidat tutarını (formda hazır gelmesi için) ve
// sakinin KENDİ dairesinin bildirim geçmişini (yeniden eskiye, son 2 kayıt) döner.
// Ana ekran kısa kalsın diye sadece son 2 bildirim gönderilir; tüm aylar "Aidat takvimim" ekranında görülür.
router.get('/benim', async (req, res) => {
  const { id, siteId, daireId } = req.kullanici;
  // Sakinin daireye giriş tarihi (bkz. Kullanici.daireyeGirisTarihi): ondan önce gönderilmiş bildirimler
  // (dairenin önceki sakinine ait) gösterilmez.
  const giris = Kullanici.daireyeGirisTarihi(await Kullanici.findById(id).select('daireyeGiris createdAt').lean());
  // Promise.all: iki sorguyu sırayla değil AYNI ANDA çalıştırır, cevap daha hızlı döner.
  // Aidat sorgusu hem siteId hem daireId ile filtrelenir: sakin başka dairenin kaydını göremez.
  const [site, bildirimler] = await Promise.all([
    Site.findById(siteId).select('aidatTutari').lean(),
    // Sadece sakinin KENDİ gönderdiği bildirimler (yöneticinin elle işaretledikleri takvimde görünür).
    Aidat.find({ siteId, daireId, odemeYontemi: { $ne: 'yonetici' }, tarih: { $gte: giris } })
      .sort({ tarih: -1 })
      .limit(2)
      .lean(),
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
// Kayıt oluşunca sitenin yöneticisine "yeni aidat bildirimi" push bildirimi gönderilir.
router.post('/', dogrula(bildirimSemasi), async (req, res) => {
  const { siteId, daireId } = req.kullanici;
  const { ay, yil, tutar, odemeYontemi, aciklama } = req.body;

  if (!son12AyIcinde(ay, yil)) {
    throw new ApiHatasi(400, 'Sadece bu ay ve önceki 11 ay için bildirim gönderilebilir.');
  }

  // Reddedilen bildirimler sayılmaz: reddedilen aya tekrar bildirim gönderilebilir.
  const mevcut = await Aidat.findOne({ siteId, daireId, ay, yil, durum: { $in: ['bekliyor', 'onaylandi'] } })
    .select('tarih')
    .lean();
  if (mevcut) {
    // Kayıt bu sakin katılmadan önce oluşturulduysa dairenin ÖNCEKİ sakinine aittir (daire el değiştirmiş);
    // sakin o kaydı hiçbir ekranda göremediği için mesaj buna göre verilir. "Katılma" anı daireye giriş tarihidir.
    const giris = Kullanici.daireyeGirisTarihi(
      await Kullanici.findById(req.kullanici.id).select('daireyeGiris createdAt').lean()
    );
    throw new ApiHatasi(
      409,
      mevcut.tarih < giris
        ? 'Bu ay için dairenin önceki sakinine ait bir aidat kaydı var. Lütfen yöneticinizle görüşün.'
        : 'Bu ay için zaten bekleyen veya onaylanmış bir bildiriminiz var.'
    );
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

  // Yöneticiye "yeni aidat bildirimi" push'u gider; bekleyen bildirimleri onaylaması gerektiğini öğrenir.
  // Yönetici, sakinin kendi sitesindeki (token'dan gelen siteId) "yonetici" rolündeki kişidir; her sitenin
  // tek yöneticisi vardır. Daire adı (örn. "A5") Daire + Bina kayıtlarından birleştirilir; hepsi siteId ile filtrelenir.
  // Bildirim gönderilemezse aidat bildirimi yine kaydedilmiş sayılır; hata sadece loglanır.
  try {
    const yonetici = await Kullanici.findOne({ siteId, rol: 'yonetici', pushToken: { $ne: null } })
      .select('pushToken')
      .lean();
    if (yonetici) {
      const daire = await Daire.findOne({ _id: daireId, siteId }).select('binaId daireNo').lean();
      const bina = daire && (await Bina.findOne({ _id: daire.binaId, siteId }).select('ad').lean());
      const daireAdi = bina ? `${bina.ad}${daire.daireNo}` : 'Bir daire';
      await pushGonder([yonetici.pushToken], {
        baslik: 'Yeni aidat bildirimi',
        icerik: `${daireAdi}: ${ayYazisi(ay, yil)} aidatını ödediğini bildirdi. Onay bekliyor.`,
        veri: { ekran: 'BekleyenBildirimler' },
      });
    }
  } catch (hata) {
    console.error('Aidat bildirimi push gönderilemedi:', hata.message);
  }

  res.status(201).json({ id: aidat._id, durum: aidat.durum });
});

module.exports = router;
