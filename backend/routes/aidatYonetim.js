// Aidat yönetim route'ları (yönetici tarafı): bekleyen "aidatı verdim" bildirimlerini görme,
// onaylama, reddetme, seçilen aya göre renkli daire haritası, daire takvimi ve elle "ödendi" işaretleme.
const express = require('express');
const { z } = require('zod');
const Aidat = require('../models/Aidat');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Kullanici = require('../models/Kullanici');
const Site = require('../models/Site');
const dogrula = require('../middleware/dogrula');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { pushGonder, ayYazisi } = require('../services/bildirim');
const { siteyeHatirlatmaGonder } = require('../services/hatirlatma');

const router = express.Router();

// Bu dosyadaki tüm route'lar sadece giriş yapmış YÖNETİCİ içindir.
// siteId her zaman req.kullanici'dan alınır: yönetici sadece kendi sitesinin bildirimlerini görür ve değiştirir.
router.use(girisGerekli, sadeceYonetici);

// GET /api/yonetim/aidatlar/bekleyen
// Kim kullanabilir: yönetici. Sitesindeki onay bekleyen bildirimleri, en eski en üstte olacak şekilde
// döner (önce gelen önce işlensin). Her bildirime daire adı (örn. "A3") ve sakinin adı eklenir.
router.get('/bekleyen', async (req, res) => {
  const { siteId } = req.kullanici;

  // Site verisinin tamamı siteId ile filtrelenir. Daire/bina/sakin adları tek tek değil,
  // toplu sorgularla alınır (her bildirim için ayrı sorgu atmak yavaş olurdu).
  const [bildirimler, daireler, binalar, sakinler] = await Promise.all([
    Aidat.find({ siteId, durum: 'bekliyor' }).sort({ tarih: 1 }).lean(),
    Daire.find({ siteId }).select('binaId daireNo').lean(),
    Bina.find({ siteId }).select('ad').lean(),
    Kullanici.find({ siteId, rol: 'sakin' }).select('ad daireId').lean(),
  ]);

  // id → ad eşlemeleri (Map): bir bildirimin dairesini ve sakinini hızlıca bulmak için.
  const binaAdi = new Map(binalar.map((b) => [String(b._id), b.ad]));
  const daireAdi = new Map(daireler.map((d) => [String(d._id), `${binaAdi.get(String(d.binaId))}${d.daireNo}`]));
  const sakinAdi = new Map(sakinler.map((k) => [String(k.daireId), k.ad]));

  res.json(
    bildirimler.map((a) => ({
      id: a._id,
      daire: daireAdi.get(String(a.daireId)) ?? '—',
      sakin: sakinAdi.get(String(a.daireId)) ?? '—', // sakin hesabını sildiyse ad bulunmaz
      ay: a.ay,
      yil: a.yil,
      tutar: a.tutar,
      odemeYontemi: a.odemeYontemi,
      aciklama: a.aciklama,
      tarih: a.tarih,
    }))
  );
});

// Harita isteğinin kuralları: adresteki ?ay=10&yil=2026. Adres parametreleri metin olarak gelir;
// z.coerce metni sayıya çevirip sonra kontrol eder.
const haritaSemasi = z.object({
  ay: z.coerce.number({ error: 'Ay geçersiz' }).int().min(1, 'Ay geçersiz').max(12, 'Ay geçersiz'),
  yil: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// GET /api/yonetim/aidatlar/harita?ay=10&yil=2026
// Kim kullanabilir: yönetici. Seçilen ay için sitedeki her dairenin aidat durumunu bina bina döner:
//   odendi   → o ay için onaylanmış bildirim var (yeşil)
//   bekliyor → onay bekleyen bildirim var (sarı)
//   odenmedi → bildirim yok veya sadece reddedilmiş bildirim var, o ay dairede sakin var (kırmızı)
//   bos      → ödeme kaydı yok ve o ay dairede sakin yoktu: hiç sakin yok veya sakin bu aydan
//              SONRA katıldı (gri; katılmadan önceki aylar için "ödemedi" demek haksızlık olur)
// Gelecek aylar da sorgulanabilir: yönetici ileri bir ayı elle işaretlediyse (Görev 2.4) haritada yeşil görür;
// sakini olan diğer daireler o ay henüz ödenmediği için kırmızı görünür (yönetici sakini çıkarana kadar).
// Sıra önemli: önce (router.use ile) giriş ve yönetici kontrolü, sonra dogrula ile ay/yıl kontrolü yapılır;
// geçersiz ay/yıl gelirse istek veritabanına hiç gitmeden 400 hatası döner.
router.get('/harita', dogrula(haritaSemasi, 'query'), async (req, res) => {
  const { siteId } = req.kullanici;
  const { ay, yil } = req.query;

  // Reddedilen bildirimler durumu etkilemediği için hiç alınmaz. Sakinlerin hesap açma tarihi (createdAt)
  // katıldıkları ayı bulmak için alınır.
  const [binalar, daireler, aidatlar, sakinler] = await Promise.all([
    Bina.find({ siteId }).sort({ ad: 1 }).lean(),
    Daire.find({ siteId }).sort({ daireNo: 1 }).select('binaId daireNo').lean(),
    Aidat.find({ siteId, ay, yil, durum: { $in: ['bekliyor', 'onaylandi'] } }).select('daireId durum').lean(),
    Kullanici.find({ siteId, rol: 'sakin', daireId: { $ne: null } }).select('daireId createdAt').lean(),
  ]);

  // daireId → sakinin katıldığı ayın sırası (yıl × 12 + ay). Dairesinde sakin olmayan daire bu listede yoktur.
  const katilmaSirasi = new Map(sakinler.map((k) => [String(k.daireId), Aidat.aySirasi(k.createdAt)]));
  const secilenSira = yil * 12 + ay;

  // daireId → o ayki durum ('bekliyor' veya 'onaylandi'). Bir dairede ikisinden en fazla biri olabilir.
  const aidatDurumu = new Map(aidatlar.map((a) => [String(a.daireId), a.durum]));

  // Her dairenin rengini belirleyen durum hesabı.
  const durumBul = (d) => {
    const kayit = aidatDurumu.get(String(d._id));
    if (kayit === 'onaylandi') return 'odendi';
    if (kayit === 'bekliyor') return 'bekliyor';
    // Sakin yoksa veya sakin seçilen aydan sonra katıldıysa gri, değilse kırmızı.
    const katilma = katilmaSirasi.get(String(d._id));
    return katilma !== undefined && secilenSira >= katilma ? 'odenmedi' : 'bos';
  };

  // Daireler bina bina gruplanır. binaId bir ObjectId olduğu için === yerine .equals ile karşılaştırılır
  // (=== iki ayrı nesneyi karşılaştırır ve hep false döner).
  const ozet = { odendi: 0, bekliyor: 0, odenmedi: 0, bos: 0 };
  const sonuc = binalar.map((bina) => ({
    id: bina._id,
    ad: bina.ad,
    daireler: daireler
      .filter((d) => d.binaId.equals(bina._id))
      .map((d) => {
        const durum = durumBul(d);
        ozet[durum] += 1; // alttaki "Ödedi 12 · Bekliyor 3..." özeti için sayılır
        return { id: d._id, ad: `${bina.ad}${d.daireNo}`, durum };
      }),
  }));

  res.json({ binalar: sonuc, ozet });
});

// Takvim isteğinin kuralı: adresteki ?yil=2026 (metin gelir, z.coerce sayıya çevirir).
const yilSemasi = z.object({
  yil: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// GET /api/yonetim/aidatlar/takvim/:daireId?yil=2026
// Kim kullanabilir: yönetici. Kendi sitesindeki bir dairenin seçilen yıldaki 12 ayının aidat durumunu döner.
// Daire başka bir siteye aitse veya yoksa 404 (varlığı belli edilmez).
router.get('/takvim/:daireId', dogrula(yilSemasi, 'query'), async (req, res) => {
  const { siteId } = req.kullanici;
  // Daire sadece yöneticinin kendi sitesinde aranır (site izolasyonu). Geçersiz id → CastError → 404.
  const daire = await Daire.findOne({ _id: req.params.daireId, siteId }).lean();
  if (!daire) throw new ApiHatasi(404, 'Daire bulunamadı.');

  // Dairedeki sakin (varsa): katıldığı aydan önceki aylar takvimde gri görünür.
  const sakin = await Kullanici.findOne({ siteId, daireId: daire._id, rol: 'sakin' }).select('createdAt').lean();
  res.json({ aylar: await Aidat.yillikTakvim(siteId, daire._id, req.query.yil, sakin?.createdAt ?? null) });
});

// Elle işaretleme formunun kuralları. daireId: MongoDB kimliği biçiminde (24 karakter onaltılık).
const elleSemasi = z.object({
  daireId: z.string({ error: 'Daire seçilmeli' }).regex(/^[a-f\d]{24}$/i, 'Daire geçersiz'),
  ay: z.number({ error: 'Ay seçilmeli' }).int().min(1, 'Ay geçersiz').max(12, 'Ay geçersiz'),
  yil: z.number({ error: 'Yıl seçilmeli' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// POST /api/yonetim/aidatlar/elle
// Kim kullanabilir: yönetici. Bir daire için bir ayı "ödendi" olarak işaretler (örn. sakin Ekim'de
// 2 aylık ödediyse Kasım'ı işaretler). Gelecek aylar da işaretlenebilir (en fazla gelecek yıl).
// İşaretlenen ay ödenmiş sayıldığı için o aya hatırlatma gitmez (Görev 5.1).
router.post('/elle', dogrula(elleSemasi), async (req, res) => {
  const { siteId } = req.kullanici;
  const { daireId, ay, yil } = req.body;

  if (yil > new Date().getFullYear() + 1) {
    throw new ApiHatasi(400, 'En fazla gelecek yılın ayları işaretlenebilir.');
  }

  // Daire yöneticinin kendi sitesinde mi? Değilse 404 (başka sitenin dairesi işaretlenemez).
  const daire = await Daire.exists({ _id: daireId, siteId });
  if (!daire) throw new ApiHatasi(404, 'Daire bulunamadı.');

  // O ay için zaten kayıt varsa: onaylıysa işaretlemeye gerek yok, bekliyorsa bildirim onaylanmalı.
  const mevcut = await Aidat.findOne({ siteId, daireId, ay, yil, durum: { $in: ['bekliyor', 'onaylandi'] } }).lean();
  if (mevcut?.durum === 'onaylandi') throw new ApiHatasi(409, 'Bu ay zaten ödendi olarak görünüyor.');
  if (mevcut?.durum === 'bekliyor') {
    throw new ApiHatasi(409, 'Bu ay için onay bekleyen bir bildirim var. Bekleyen bildirimlerden onaylayın.');
  }

  // Tutar olarak sitenin aylık aidat tutarı yazılır (belirlenmemişse 0). Kayıt doğrudan onaylıdır.
  // Aynı anda bir sakin bildirimi veya ikinci bir işaretleme gelip yukarıdaki kontrolü birlikte geçerse,
  // modeldeki unique index ikinci kaydı reddeder (11000 → merkezi hata yakalayıcı 409 döner).
  const site = await Site.findById(siteId).select('aidatTutari').lean();
  await Aidat.create({
    siteId,
    daireId,
    ay,
    yil,
    tutar: site?.aidatTutari ?? 0,
    odemeYontemi: 'yonetici',
    aciklama: 'Yönetici tarafından ödendi olarak işaretlendi',
    durum: 'onaylandi',
  });

  res.status(201).json({ ay, yil, durum: 'odendi' });
});

// Bekleyen bir bildirimin durumunu değiştirir. Sadece yöneticinin KENDİ sitesindeki ve hâlâ
// "bekliyor" olan bildirim değişir; tek bir veritabanı işlemiyle bulunup güncellenir.
// Neden tek işlem: butona iki kez basılırsa veya iki cihazdan aynı anda işlenirse, ilki durumu
// değiştirdiği için ikincisi "bekliyor" kaydı bulamaz ve 404 alır (bildirim iki kez sonuçlanmaz).
// Başka sitenin bildirimi, olmayan bir id veya zaten sonuçlanmış bildirim → 404 (var olduğu belli edilmez).
async function durumDegistir(req, res, yeniDurum) {
  const aidat = await Aidat.findOneAndUpdate(
    { _id: req.params.id, siteId: req.kullanici.siteId, durum: 'bekliyor' },
    { durum: yeniDurum },
    { returnDocument: 'after' } // güncellenmiş hali döner (yeni durum cevapta gönderilsin diye)
  );
  if (!aidat) {
    throw new ApiHatasi(404, 'Bildirim bulunamadı veya zaten sonuçlandırılmış.');
  }

  // Sakine sonucu push ile bildirir: onaylandıysa "ödendi", reddedildiyse tekrar bildirim atabileceği söylenir.
  // Alıcı, aidatın dairesinde oturan sakindir; sorgu siteId ile filtrelenir (başka sitedeki kimseye gitmez).
  // Bildirim gönderilemezse onay/red yine geçerlidir; hata sadece loglanır.
  try {
    const sakin = await Kullanici.findOne({
      siteId: aidat.siteId,
      daireId: aidat.daireId,
      rol: 'sakin',
      pushToken: { $ne: null },
    })
      .select('pushToken')
      .lean();
    if (sakin) {
      const ay = ayYazisi(aidat.ay, aidat.yil);
      await pushGonder(
        [sakin.pushToken],
        yeniDurum === 'onaylandi'
          ? { baslik: 'Aidatınız onaylandı', icerik: `${ay} aidatınız ödendi olarak işlendi.`, veri: { ekran: 'AidatTakvimi' } }
          : {
              baslik: 'Aidat bildiriminiz reddedildi',
              icerik: `${ay} bildiriminiz yönetici tarafından reddedildi. Bilgileri kontrol edip tekrar bildirebilirsiniz.`,
              veri: { ekran: 'AidatBildir' },
            }
      );
    }
  } catch (hata) {
    console.error('Aidat sonucu push gönderilemedi:', hata.message);
  }

  res.json({ id: aidat._id, durum: aidat.durum });
}

// POST /api/yonetim/aidatlar/hatirlatma
// Kim kullanabilir: yönetici. Otomatik hatırlatmayı (her ayın 10'u) beklemeden, KENDİ sitesinde bu ayın
// aidatını ödemeyen sakinlere hemen hatırlatma gönderir (sunumda denemek için). siteId token'dan alınır.
// Cevap: { odemeyen, bildirimGiden } → mobil, kaç daireye gönderildiğini yöneticiye gösterir.
// Asıl iş services/hatirlatma.js'teki siteyeHatirlatmaGonder'dadır; otomatik görev de aynı fonksiyonu
// kullanır, böylece "ödemeyen kim?" kuralı tek yerde durur. Ay ve yıl istekten değil, sunucunun saatinden alınır.
router.post('/hatirlatma', async (req, res) => {
  const simdi = new Date();
  res.json(await siteyeHatirlatmaGonder(req.kullanici.siteId, simdi.getMonth() + 1, simdi.getFullYear()));
});

// POST /api/yonetim/aidatlar/:id/onayla
// Kim kullanabilir: yönetici. Bildirimi onaylar; o ay o daire için "ödendi" sayılır.
// Aynı daire + ay için ikinci bir onaylı kayıt oluşamaz: Aidat modelindeki kural bir ayda
// tek bekleyen/onaylı kayda izin verir.
// Onaydan sonra sakine "Aidatınız onaylandı" push bildirimi gider (durumDegistir içinde).
// durumDegistir async olduğu için 404 hatası Express 5 tarafından yakalanıp merkezi hata yakalayıcıya gider.
router.post('/:id/onayla', (req, res) => durumDegistir(req, res, 'onaylandi'));

// POST /api/yonetim/aidatlar/:id/reddet
// Kim kullanabilir: yönetici. Bildirimi reddeder; sakin aynı ay için yeniden bildirim gönderebilir.
// Reddedince sakine "bildiriminiz reddedildi" push bildirimi gider (durumDegistir içinde).
router.post('/:id/reddet', (req, res) => durumDegistir(req, res, 'reddedildi'));

module.exports = router;
