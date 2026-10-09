// Aidat yönetim route'ları (yönetici tarafı): bekleyen "aidatı verdim" bildirimlerini görme,
// onaylama, reddetme, seçilen aya göre renkli daire haritası, daire takvimi ve elle "ödendi" işaretleme.
const express = require('express');
const { z } = require('zod');
const Due = require('../models/Due');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const User = require('../models/User');
const Site = require('../models/Site');
const validate = require('../middleware/validate');
const { requireAuth, managerOnly } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { sendPush, monthText } = require('../services/pushNotifications');
const { sendSiteReminder } = require('../services/reminders');
const { flatNames } = require('../services/flat');

const router = express.Router();

// Bu dosyadaki tüm route'lar sadece giriş yapmış YÖNETİCİ içindir.
// siteId her zaman req.kullanici'dan alınır: yönetici sadece kendi sitesinin bildirimlerini görür ve değiştirir.
router.use(requireAuth, managerOnly);

// GET /api/yonetim/aidatlar/bekleyen
// Kim kullanabilir: yönetici. Sitesindeki onay bekleyen bildirimleri, en eski en üstte olacak şekilde
// döner (önce gelen önce işlensin). Her bildirime daire adı (örn. "A3") ve sakinin adı eklenir.
router.get('/bekleyen', async (req, res) => {
  const { siteId } = req.kullanici;

  // Site verisinin tamamı siteId ile filtrelenir. Daire/bina/sakin adları tek tek değil,
  // toplu sorgularla alınır (her bildirim için ayrı sorgu atmak yavaş olurdu).
  // flatNames: flatId → "A3" eşlemesi (ortak yardımcı, services/flat.js).
  const [reports, flatNameById, residents] = await Promise.all([
    Due.find({ siteId, durum: 'bekliyor' }).sort({ tarih: 1 }).lean(),
    flatNames(siteId),
    // rol filtresi yok: dairede şu an kayıtlı kişinin adı görünür (devirle yönetici olmuş olsa da; dairesi kayıtlı kalır).
    User.find({ siteId, daireId: { $ne: null } }).select('ad daireId').lean(),
  ]);

  // flatId → sakinin adı eşlemesi (Map): her bildirimin dairesinde oturan sakini ayrı sorgu atmadan bulmak için.
  const residentName = new Map(residents.map((k) => [String(k.daireId), k.ad]));

  res.json(
    reports.map((a) => ({
      id: a._id,
      daire: flatNameById.get(String(a.daireId)) ?? '—',
      sakin: residentName.get(String(a.daireId)) ?? '—', // sakin hesabını sildiyse ad bulunmaz
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
const mapSchema = z.object({
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
// Sıra önemli: önce (router.use ile) giriş ve yönetici kontrolü, sonra validate ile ay/yıl kontrolü yapılır;
// geçersiz ay/yıl gelirse istek veritabanına hiç gitmeden 400 hatası döner.
router.get('/harita', validate(mapSchema, 'query'), async (req, res) => {
  const { siteId } = req.kullanici;
  const { ay: month, yil: year } = req.query;

  // Reddedilen bildirimler durumu etkilemediği için hiç alınmaz. Sakinlerin daireye giriş tarihi (daireyeGiris, yoksa createdAt)
  // katıldıkları ayı bulmak için alınır.
  const [buildings, flats, dues, residents] = await Promise.all([
    Building.find({ siteId }).sort({ ad: 1 }).lean(),
    Flat.find({ siteId }).sort({ daireNo: 1 }).select('binaId daireNo').lean(),
    Due.find({ siteId, ay: month, yil: year, durum: { $in: ['bekliyor', 'onaylandi'] } }).select('daireId durum').lean(),
    User.find({ siteId, rol: 'sakin', daireId: { $ne: null } }).select('daireId daireyeGiris createdAt').lean(),
  ]);

  // flatId → sakinin katıldığı ayın sırası (yıl × 12 + ay). Dairesinde sakin olmayan daire bu listede yoktur.
  const joinIndex = new Map(residents.map((k) => [String(k.daireId), Due.monthIndex(User.moveInDateOf(k))]));
  const selectedIndex = year * 12 + month;

  // flatId → o ayki durum ('bekliyor' veya 'onaylandi'). Bir dairede ikisinden en fazla biri olabilir.
  const dueStatus = new Map(dues.map((a) => [String(a.daireId), a.durum]));

  // Her dairenin rengini belirleyen durum hesabı.
  const findStatus = (d) => {
    const record = dueStatus.get(String(d._id));
    if (record === 'onaylandi') return 'odendi';
    if (record === 'bekliyor') return 'bekliyor';
    // Sakin yoksa veya sakin seçilen aydan sonra katıldıysa gri, değilse kırmızı.
    const joinMonthIndex = joinIndex.get(String(d._id));
    return joinMonthIndex !== undefined && selectedIndex >= joinMonthIndex ? 'odenmedi' : 'bos';
  };

  // Daireler bina bina gruplanır. binaId bir ObjectId olduğu için === yerine .equals ile karşılaştırılır
  // (=== iki ayrı nesneyi karşılaştırır ve hep false döner).
  const summary = { odendi: 0, bekliyor: 0, odenmedi: 0, bos: 0 };
  const result = buildings.map((building) => ({
    id: building._id,
    ad: building.ad,
    daireler: flats
      .filter((d) => d.binaId.equals(building._id))
      .map((d) => {
        const status = findStatus(d);
        summary[status] += 1; // alttaki "Ödedi 12 · Bekliyor 3..." özeti için sayılır
        return { id: d._id, ad: `${building.ad}${d.daireNo}`, durum: status };
      }),
  }));

  res.json({ binalar: result, ozet: summary });
});

// Takvim isteğinin kuralı: adresteki ?yil=2026 (metin gelir, z.coerce sayıya çevirir).
const yearSchema = z.object({
  yil: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// GET /api/yonetim/aidatlar/takvim/:daireId?yil=2026
// Kim kullanabilir: yönetici. Kendi sitesindeki bir dairenin seçilen yıldaki 12 ayının aidat durumunu döner.
// Daire başka bir siteye aitse veya yoksa 404 (varlığı belli edilmez).
router.get('/takvim/:daireId', validate(yearSchema, 'query'), async (req, res) => {
  const { siteId } = req.kullanici;
  // Daire sadece yöneticinin kendi sitesinde aranır (site izolasyonu). Geçersiz id → CastError → 404.
  const flat = await Flat.findOne({ _id: req.params.daireId, siteId }).lean();
  if (!flat) throw new ApiError(404, 'Daire bulunamadı.');

  // Dairedeki sakin (varsa): daireye giriş tarihinden (moveInDateOf) önceki aylar takvimde gri görünür.
  const resident = await User.findOne({ siteId, daireId: flat._id, rol: 'sakin' }).select('daireyeGiris createdAt').lean();
  const moveInDate = resident ? User.moveInDateOf(resident) : null;
  res.json({ aylar: await Due.yearlyCalendar(siteId, flat._id, req.query.yil, moveInDate) });
});

// Elle işaretleme formunun kuralları. daireId: MongoDB kimliği biçiminde (24 karakter onaltılık).
const manualSchema = z.object({
  daireId: z.string({ error: 'Daire seçilmeli' }).regex(/^[a-f\d]{24}$/i, 'Daire geçersiz'),
  ay: z.number({ error: 'Ay seçilmeli' }).int().min(1, 'Ay geçersiz').max(12, 'Ay geçersiz'),
  yil: z.number({ error: 'Yıl seçilmeli' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// POST /api/yonetim/aidatlar/elle
// Kim kullanabilir: yönetici. Bir daire için bir ayı "ödendi" olarak işaretler (örn. sakin Ekim'de
// 2 aylık ödediyse Kasım'ı işaretler). Gelecek aylar da işaretlenebilir (en fazla gelecek yıl).
// İşaretlenen ay ödenmiş sayıldığı için o aya hatırlatma gitmez (Görev 5.1).
router.post('/elle', validate(manualSchema), async (req, res) => {
  const { siteId } = req.kullanici;
  const { daireId: flatId, ay: month, yil: year } = req.body;

  if (year > new Date().getFullYear() + 1) {
    throw new ApiError(400, 'En fazla gelecek yılın ayları işaretlenebilir.');
  }

  // Daire yöneticinin kendi sitesinde mi? Değilse 404 (başka sitenin dairesi işaretlenemez).
  const flat = await Flat.exists({ _id: flatId, siteId });
  if (!flat) throw new ApiError(404, 'Daire bulunamadı.');

  // O ay için zaten kayıt varsa: onaylıysa işaretlemeye gerek yok, bekliyorsa bildirim onaylanmalı.
  const existing = await Due.findOne({ siteId, daireId: flatId, ay: month, yil: year, durum: { $in: ['bekliyor', 'onaylandi'] } }).lean();
  if (existing?.durum === 'onaylandi') throw new ApiError(409, 'Bu ay zaten ödendi olarak görünüyor.');
  if (existing?.durum === 'bekliyor') {
    throw new ApiError(409, 'Bu ay için onay bekleyen bir bildirim var. Bekleyen bildirimlerden onaylayın.');
  }

  // Tutar olarak sitenin aylık aidat tutarı yazılır (belirlenmemişse 0). Kayıt doğrudan onaylıdır.
  // Aynı anda bir sakin bildirimi veya ikinci bir işaretleme gelip yukarıdaki kontrolü birlikte geçerse,
  // modeldeki unique index ikinci kaydı reddeder (11000 → merkezi hata yakalayıcı 409 döner).
  const site = await Site.findById(siteId).select('aidatTutari').lean();
  await Due.create({
    siteId,
    daireId: flatId,
    ay: month,
    yil: year,
    tutar: site?.aidatTutari ?? 0,
    odemeYontemi: 'yonetici',
    aciklama: 'Yönetici tarafından ödendi olarak işaretlendi',
    durum: 'onaylandi',
  });

  res.status(201).json({ ay: month, yil: year, durum: 'odendi' });
});

// Bekleyen bir bildirimin durumunu değiştirir. Sadece yöneticinin KENDİ sitesindeki ve hâlâ
// "bekliyor" olan bildirim değişir; tek bir veritabanı işlemiyle bulunup güncellenir.
// Neden tek işlem: butona iki kez basılırsa veya iki cihazdan aynı anda işlenirse, ilki durumu
// değiştirdiği için ikincisi "bekliyor" kaydı bulamaz ve 404 alır (bildirim iki kez sonuçlanmaz).
// Başka sitenin bildirimi, olmayan bir id veya zaten sonuçlanmış bildirim → 404 (var olduğu belli edilmez).
async function changeStatus(req, res, newStatus) {
  const due = await Due.findOneAndUpdate(
    { _id: req.params.id, siteId: req.kullanici.siteId, durum: 'bekliyor' },
    { durum: newStatus },
    { returnDocument: 'after' } // güncellenmiş hali döner (yeni durum cevapta gönderilsin diye)
  );
  if (!due) {
    throw new ApiError(404, 'Bildirim bulunamadı veya zaten sonuçlandırılmış.');
  }

  // Sakine sonucu push ile bildirir: onaylandıysa "ödendi", reddedildiyse tekrar bildirim atabileceği söylenir.
  // Alıcı, aidatın dairesinde oturan sakindir; sorgu siteId ile filtrelenir (başka sitedeki kimseye gitmez).
  // Bildirim gönderilemezse onay/red yine geçerlidir; hata sadece loglanır.
  try {
    const resident = await User.findOne({
      siteId: due.siteId,
      daireId: due.daireId,
      rol: 'sakin',
      pushToken: { $ne: null },
    })
      .select('pushToken')
      .lean();
    if (resident) {
      const month = monthText(due.ay, due.yil);
      await sendPush(
        [resident.pushToken],
        newStatus === 'onaylandi'
          ? { baslik: 'Aidatınız onaylandı', icerik: `${month} aidatınız ödendi olarak işlendi.`, pushData: { ekran: 'AidatTakvimi' } }
          : {
              baslik: 'Aidat bildiriminiz reddedildi',
              icerik: `${month} bildiriminiz yönetici tarafından reddedildi. Bilgileri kontrol edip tekrar bildirebilirsiniz.`,
              pushData: { ekran: 'AidatBildir' },
            }
      );
    }
  } catch (error) {
    console.error('Aidat sonucu push gönderilemedi:', error.message);
  }

  res.json({ id: due._id, durum: due.durum });
}

// POST /api/yonetim/aidatlar/hatirlatma
// Kim kullanabilir: yönetici. Otomatik hatırlatmayı (her ayın 10'u) beklemeden, KENDİ sitesinde bu ayın
// aidatını ödemeyen sakinlere hemen hatırlatma gönderir (sunumda denemek için). siteId token'dan alınır.
// Cevap: { odemeyen, bildirimGiden } → mobil, kaç daireye gönderildiğini yöneticiye gösterir.
// Asıl iş services/reminders.js'teki sendSiteReminder'dadır; otomatik görev de aynı fonksiyonu
// kullanır, böylece "ödemeyen kim?" kuralı tek yerde durur. Ay ve yıl istekten değil, sunucunun saatinden alınır.
router.post('/hatirlatma', async (req, res) => {
  const now = new Date();
  res.json(await sendSiteReminder(req.kullanici.siteId, now.getMonth() + 1, now.getFullYear()));
});

// POST /api/yonetim/aidatlar/:id/onayla
// Kim kullanabilir: yönetici. Bildirimi onaylar; o ay o daire için "ödendi" sayılır.
// Aynı daire + ay için ikinci bir onaylı kayıt oluşamaz: Due modelindeki kural bir ayda
// tek bekleyen/onaylı kayda izin verir.
// Onaydan sonra sakine "Aidatınız onaylandı" push bildirimi gider (changeStatus içinde).
// changeStatus async olduğu için 404 hatası Express 5 tarafından yakalanıp merkezi hata yakalayıcıya gider.
router.post('/:id/onayla', (req, res) => changeStatus(req, res, 'onaylandi'));

// POST /api/yonetim/aidatlar/:id/reddet
// Kim kullanabilir: yönetici. Bildirimi reddeder; sakin aynı ay için yeniden bildirim gönderebilir.
// Reddedince sakine "bildiriminiz reddedildi" push bildirimi gider (changeStatus içinde).
router.post('/:id/reddet', (req, res) => changeStatus(req, res, 'reddedildi'));

module.exports = router;
