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
// siteId her zaman req.user'dan alınır: yönetici sadece kendi sitesinin bildirimlerini görür ve değiştirir.
router.use(requireAuth, managerOnly);

// GET /api/manager/dues/pending
// Kim kullanabilir: yönetici. Sitesindeki onay bekleyen bildirimleri, en eski en üstte olacak şekilde
// döner (önce gelen önce işlensin). Her bildirime daire adı (örn. "A3") ve sakinin adı eklenir.
router.get('/pending', async (req, res) => {
  const { siteId } = req.user;

  // Site verisinin tamamı siteId ile filtrelenir. Daire/bina/sakin adları tek tek değil,
  // toplu sorgularla alınır (her bildirim için ayrı sorgu atmak yavaş olurdu).
  // flatNames: flatId → "A3" eşlemesi (ortak yardımcı, services/flat.js).
  const [reports, flatNameById, residents] = await Promise.all([
    Due.find({ siteId, status: 'pending' }).sort({ date: 1 }).lean(),
    flatNames(siteId),
    // role filtresi yok: dairede şu an kayıtlı kişinin adı görünür (devirle yönetici olmuş olsa da; dairesi kayıtlı kalır).
    User.find({ siteId, flatId: { $ne: null } }).select('name flatId').lean(),
  ]);

  // flatId → sakinin adı eşlemesi (Map): her bildirimin dairesinde oturan sakini ayrı sorgu atmadan bulmak için.
  const residentName = new Map(residents.map((k) => [String(k.flatId), k.name]));

  res.json(
    reports.map((a) => ({
      id: a._id,
      flat: flatNameById.get(String(a.flatId)) ?? '—',
      resident: residentName.get(String(a.flatId)) ?? '—', // sakin hesabını sildiyse ad bulunmaz
      month: a.month,
      year: a.year,
      amount: a.amount,
      paymentMethod: a.paymentMethod,
      note: a.note,
      date: a.date,
    }))
  );
});

// Harita isteğinin kuralları: adresteki ?month=10&year=2026. Adres parametreleri metin olarak gelir;
// z.coerce metni sayıya çevirip sonra kontrol eder.
const mapSchema = z.object({
  month: z.coerce.number({ error: 'Ay geçersiz' }).int().min(1, 'Ay geçersiz').max(12, 'Ay geçersiz'),
  year: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// GET /api/manager/dues/map?month=10&year=2026
// Kim kullanabilir: yönetici. Seçilen ay için sitedeki her dairenin aidat durumunu bina bina döner:
//   paid    → o ay için onaylanmış bildirim var (yeşil)
//   pending → onay bekleyen bildirim var (sarı)
//   unpaid  → bildirim yok veya sadece reddedilmiş bildirim var, o ay dairede sakin var (kırmızı)
//   empty   → ödeme kaydı yok ve o ay dairede sakin yoktu: hiç sakin yok veya sakin bu aydan
//              SONRA katıldı (gri; katılmadan önceki aylar için "ödemedi" demek haksızlık olur)
// Gelecek aylar da sorgulanabilir: yönetici ileri bir ayı elle işaretlediyse (Görev 2.4) haritada yeşil görür;
// sakini olan diğer daireler o ay henüz ödenmediği için kırmızı görünür (yönetici sakini çıkarana kadar).
// Sıra önemli: önce (router.use ile) giriş ve yönetici kontrolü, sonra validate ile ay/yıl kontrolü yapılır;
// geçersiz ay/yıl gelirse istek veritabanına hiç gitmeden 400 hatası döner.
router.get('/map', validate(mapSchema, 'query'), async (req, res) => {
  const { siteId } = req.user;
  const { month, year } = req.query;

  // Reddedilen bildirimler durumu etkilemediği için hiç alınmaz. Sakinlerin daireye giriş tarihi (moveInDate, yoksa createdAt)
  // katıldıkları ayı bulmak için alınır.
  const [buildings, flats, dues, residents] = await Promise.all([
    Building.find({ siteId }).sort({ name: 1 }).lean(),
    Flat.find({ siteId }).sort({ flatNumber: 1 }).select('buildingId flatNumber').lean(),
    Due.find({ siteId, month, year, status: { $in: ['pending', 'approved'] } }).select('flatId status').lean(),
    User.find({ siteId, role: 'resident', flatId: { $ne: null } }).select('flatId moveInDate createdAt').lean(),
  ]);

  // flatId → sakinin katıldığı ayın sırası (yıl × 12 + ay). Dairesinde sakin olmayan daire bu listede yoktur.
  const joinIndex = new Map(residents.map((k) => [String(k.flatId), Due.monthIndex(User.moveInDateOf(k))]));
  const selectedIndex = year * 12 + month;

  // flatId → o ayki durum ('pending' veya 'approved'). Bir dairede ikisinden en fazla biri olabilir.
  const dueStatus = new Map(dues.map((a) => [String(a.flatId), a.status]));

  // Her dairenin rengini belirleyen durum hesabı.
  const findStatus = (d) => {
    const record = dueStatus.get(String(d._id));
    if (record === 'approved') return 'paid';
    if (record === 'pending') return 'pending';
    // Sakin yoksa veya sakin seçilen aydan sonra katıldıysa gri, değilse kırmızı.
    const joinMonthIndex = joinIndex.get(String(d._id));
    return joinMonthIndex !== undefined && selectedIndex >= joinMonthIndex ? 'unpaid' : 'empty';
  };

  // Daireler bina bina gruplanır. buildingId bir ObjectId olduğu için === yerine .equals ile karşılaştırılır
  // (=== iki ayrı nesneyi karşılaştırır ve hep false döner).
  const summary = { paid: 0, pending: 0, unpaid: 0, empty: 0 };
  const result = buildings.map((building) => ({
    id: building._id,
    name: building.name,
    flats: flats
      .filter((d) => d.buildingId.equals(building._id))
      .map((d) => {
        const status = findStatus(d);
        summary[status] += 1; // alttaki "Ödedi 12 · Bekliyor 3..." özeti için sayılır
        return { id: d._id, name: `${building.name}${d.flatNumber}`, status };
      }),
  }));

  res.json({ buildings: result, summary });
});

// Takvim isteğinin kuralı: adresteki ?year=2026 (metin gelir, z.coerce sayıya çevirir).
const yearSchema = z.object({
  year: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// GET /api/manager/dues/calendar/:flatId?year=2026
// Kim kullanabilir: yönetici. Kendi sitesindeki bir dairenin seçilen yıldaki 12 ayının aidat durumunu döner.
// Daire başka bir siteye aitse veya yoksa 404 (varlığı belli edilmez).
router.get('/calendar/:flatId', validate(yearSchema, 'query'), async (req, res) => {
  const { siteId } = req.user;
  // Daire sadece yöneticinin kendi sitesinde aranır (site izolasyonu). Geçersiz id → CastError → 404.
  const flat = await Flat.findOne({ _id: req.params.flatId, siteId }).lean();
  if (!flat) throw new ApiError(404, 'Daire bulunamadı.');

  // Dairedeki sakin (varsa): daireye giriş tarihinden (moveInDateOf) önceki aylar takvimde gri görünür.
  const resident = await User.findOne({ siteId, flatId: flat._id, role: 'resident' }).select('moveInDate createdAt').lean();
  const moveInDate = resident ? User.moveInDateOf(resident) : null;
  res.json({ months: await Due.yearlyCalendar(siteId, flat._id, req.query.year, moveInDate) });
});

// Elle işaretleme formunun kuralları. flatId: MongoDB kimliği biçiminde (24 karakter onaltılık).
const manualSchema = z.object({
  flatId: z.string({ error: 'Daire seçilmeli' }).regex(/^[a-f\d]{24}$/i, 'Daire geçersiz'),
  month: z.number({ error: 'Ay seçilmeli' }).int().min(1, 'Ay geçersiz').max(12, 'Ay geçersiz'),
  year: z.number({ error: 'Yıl seçilmeli' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// POST /api/manager/dues/manual
// Kim kullanabilir: yönetici. Bir daire için bir ayı "ödendi" olarak işaretler (örn. sakin Ekim'de
// 2 aylık ödediyse Kasım'ı işaretler). Gelecek aylar da işaretlenebilir (en fazla gelecek yıl).
// İşaretlenen ay ödenmiş sayıldığı için o aya hatırlatma gitmez (Görev 5.1).
router.post('/manual', validate(manualSchema), async (req, res) => {
  const { siteId } = req.user;
  const { flatId, month, year } = req.body;

  if (year > new Date().getFullYear() + 1) {
    throw new ApiError(400, 'En fazla gelecek yılın ayları işaretlenebilir.');
  }

  // Daire yöneticinin kendi sitesinde mi? Değilse 404 (başka sitenin dairesi işaretlenemez).
  const flat = await Flat.exists({ _id: flatId, siteId });
  if (!flat) throw new ApiError(404, 'Daire bulunamadı.');

  // O ay için zaten kayıt varsa: onaylıysa işaretlemeye gerek yok, bekliyorsa bildirim onaylanmalı.
  const existing = await Due.findOne({ siteId, flatId, month, year, status: { $in: ['pending', 'approved'] } }).lean();
  if (existing?.status === 'approved') throw new ApiError(409, 'Bu ay zaten ödendi olarak görünüyor.');
  if (existing?.status === 'pending') {
    throw new ApiError(409, 'Bu ay için onay bekleyen bir bildirim var. Bekleyen bildirimlerden onaylayın.');
  }

  // Tutar olarak sitenin aylık aidat tutarı yazılır (belirlenmemişse 0). Kayıt doğrudan onaylıdır.
  // Aynı anda bir sakin bildirimi veya ikinci bir işaretleme gelip yukarıdaki kontrolü birlikte geçerse,
  // modeldeki unique index ikinci kaydı reddeder (11000 → merkezi hata yakalayıcı 409 döner).
  const site = await Site.findById(siteId).select('dueAmount').lean();
  await Due.create({
    siteId,
    flatId,
    month,
    year,
    amount: site?.dueAmount ?? 0,
    paymentMethod: 'manager',
    note: 'Yönetici tarafından ödendi olarak işaretlendi',
    status: 'approved',
  });

  res.status(201).json({ month, year, status: 'paid' });
});

// Bekleyen bir bildirimin durumunu değiştirir. Sadece yöneticinin KENDİ sitesindeki ve hâlâ
// 'pending' olan bildirim değişir; tek bir veritabanı işlemiyle bulunup güncellenir.
// Neden tek işlem: butona iki kez basılırsa veya iki cihazdan aynı anda işlenirse, ilki durumu
// değiştirdiği için ikincisi 'pending' kaydı bulamaz ve 404 alır (bildirim iki kez sonuçlanmaz).
// Başka sitenin bildirimi, olmayan bir id veya zaten sonuçlanmış bildirim → 404 (var olduğu belli edilmez).
async function changeStatus(req, res, newStatus) {
  const due = await Due.findOneAndUpdate(
    { _id: req.params.id, siteId: req.user.siteId, status: 'pending' },
    { status: newStatus },
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
      flatId: due.flatId,
      role: 'resident',
      pushToken: { $ne: null },
    })
      .select('pushToken')
      .lean();
    if (resident) {
      const month = monthText(due.month, due.year);
      await sendPush(
        [resident.pushToken],
        newStatus === 'approved'
          ? { title: 'Aidatınız onaylandı', content: `${month} aidatınız ödendi olarak işlendi.`, pushData: { screen: 'DueCalendar' } }
          : {
              title: 'Aidat bildiriminiz reddedildi',
              content: `${month} bildiriminiz yönetici tarafından reddedildi. Bilgileri kontrol edip tekrar bildirebilirsiniz.`,
              pushData: { screen: 'ReportPayment' },
            }
      );
    }
  } catch (error) {
    console.error('Aidat sonucu push gönderilemedi:', error.message);
  }

  res.json({ id: due._id, status: due.status });
}

// POST /api/manager/dues/reminders
// Kim kullanabilir: yönetici. Otomatik hatırlatmayı (her ayın 10'u) beklemeden, KENDİ sitesinde bu ayın
// aidatını ödemeyen sakinlere hemen hatırlatma gönderir (sunumda denemek için). siteId token'dan alınır.
// Cevap: { unpaidCount, notifiedCount } → mobil, kaç daireye gönderildiğini yöneticiye gösterir.
// Asıl iş services/reminders.js'teki sendSiteReminder'dadır; otomatik görev de aynı fonksiyonu
// kullanır, böylece "ödemeyen kim?" kuralı tek yerde durur. Ay ve yıl istekten değil, sunucunun saatinden alınır.
router.post('/reminders', async (req, res) => {
  const now = new Date();
  res.json(await sendSiteReminder(req.user.siteId, now.getMonth() + 1, now.getFullYear()));
});

// POST /api/manager/dues/:id/approve
// Kim kullanabilir: yönetici. Bildirimi onaylar; o ay o daire için "ödendi" sayılır.
// Aynı daire + ay için ikinci bir onaylı kayıt oluşamaz: Due modelindeki kural bir ayda
// tek bekleyen/onaylı kayda izin verir.
// Onaydan sonra sakine "Aidatınız onaylandı" push bildirimi gider (changeStatus içinde).
// changeStatus async olduğu için 404 hatası Express 5 tarafından yakalanıp merkezi hata yakalayıcıya gider.
router.post('/:id/approve', (req, res) => changeStatus(req, res, 'approved'));

// POST /api/manager/dues/:id/reject
// Kim kullanabilir: yönetici. Bildirimi reddeder; sakin aynı ay için yeniden bildirim gönderebilir.
// Reddedince sakine "bildiriminiz reddedildi" push bildirimi gider (changeStatus içinde).
router.post('/:id/reject', (req, res) => changeStatus(req, res, 'rejected'));

module.exports = router;
