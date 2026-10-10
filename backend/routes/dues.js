// Aidat route'ları (sakin tarafı): "aidatı verdim" bildirimi gönderme ve kendi geçmişini görme.
const express = require('express');
const { z } = require('zod');
const Due = require('../models/Due');
const Site = require('../models/Site');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { amountRule } = require('../middleware/validate');
const { requireAuth, residentOnly } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { sendPush, monthText } = require('../services/pushNotifications');

const router = express.Router();

// Bu dosyadaki route'lar sadece giriş yapmış ve bir daireye bağlı SAKİN içindir.
// siteId ve flatId her zaman req.user'dan alınır: sakin sadece KENDİ dairesi adına
// bildirim gönderebilir ve sadece kendi dairesinin geçmişini görebilir.
router.use(requireAuth, residentOnly);

// Bir ayın "son 12 ay" içinde olup olmadığını kontrol eder (gelecek aylar ve çok eski aylar reddedilir).
// Ay sırası = yıl × 12 + ay: iki tarihi tek bir sayıyla karşılaştırmayı kolaylaştırır.
function withinLast12Months(month, year) {
  const now = new Date();
  const thisMonth = now.getFullYear() * 12 + now.getMonth() + 1;
  const selected = year * 12 + month;
  return selected <= thisMonth && selected > thisMonth - 12;
}

// Bildirim formunun kuralları.
const reportSchema = z.object({
  month: z.number({ error: 'Ay seçilmeli' }).int().min(1, 'Geçersiz ay').max(12, 'Geçersiz ay'),
  year: z.number({ error: 'Yıl seçilmeli' }).int(),
  amount: amountRule, // 0'dan büyük, en fazla 99.999,99 TL, en fazla 2 kuruş basamağı
  paymentMethod: z.enum(['bank', 'cash'], { error: 'Ödeme yöntemi seçilmeli' }),
  note: z.string().trim().max(200, 'Açıklama en fazla 200 karakter olabilir').default(''),
});

// GET /api/dues/calendar?year=2026
// Kim kullanabilir: sakin. KENDİ dairesinin seçilen yıldaki 12 ayının aidat durumunu döner.
// flatId istekten değil token'dan gelir: sakin başka dairenin takvimini göremez.
const yearSchema = z.object({
  year: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});
router.get('/calendar', validate(yearSchema, 'query'), async (req, res) => {
  const { id, siteId, flatId } = req.user;
  // Sakinin daireye giriş tarihi (moveInDate, eski kayıtlarda hesap açma tarihi): bu aydan önceki aylar
  // takvimde gri ("Sakin yok") görünür. Devirle sakin olan eski yönetici için devir günüdür.
  const resident = await User.findById(id).select('moveInDate createdAt').lean();
  const moveInDate = User.moveInDateOf(resident);
  const months = await Due.yearlyCalendar(siteId, flatId, req.query.year, moveInDate);
  // Daire el değiştirdiyse önceki sakinin ödemeleri yeni sakine gösterilmez (gizlilik):
  // sakinin katıldığı aydan önceki aylar, kayıt olsa bile 'empty' (gri) döner. Yönetici takviminde hepsi görünür.
  // Ay sırası = yıl × 12 + ay (Due.monthIndex ile aynı hesap): iki ayı tek bir < karşılaştırmasıyla kıyaslamak için.
  const joinIndex = Due.monthIndex(moveInDate);
  res.json({ months: months.map((a) => (req.query.year * 12 + a.month < joinIndex ? { month: a.month, status: 'empty' } : a)) });
});

// GET /api/dues/mine
// Kim kullanabilir: sakin. Sitenin aylık aidat tutarını (formda hazır gelmesi için) ve
// sakinin KENDİ dairesinin bildirim geçmişini (yeniden eskiye, son 2 kayıt) döner.
// Ana ekran kısa kalsın diye sadece son 2 bildirim gönderilir; tüm aylar "Aidat takvimim" ekranında görülür.
router.get('/mine', async (req, res) => {
  const { id, siteId, flatId } = req.user;
  // Sakinin daireye giriş tarihi (bkz. User.moveInDateOf): ondan önce gönderilmiş bildirimler
  // (dairenin önceki sakinine ait) gösterilmez.
  const moveInDate = User.moveInDateOf(await User.findById(id).select('moveInDate createdAt').lean());
  // Promise.all: iki sorguyu sırayla değil AYNI ANDA çalıştırır, cevap daha hızlı döner.
  // Aidat sorgusu hem siteId hem flatId ile filtrelenir: sakin başka dairenin kaydını göremez.
  const [site, reports] = await Promise.all([
    Site.findById(siteId).select('dueAmount').lean(),
    // Sadece sakinin KENDİ gönderdiği bildirimler (yöneticinin elle işaretledikleri takvimde görünür).
    Due.find({ siteId, flatId, paymentMethod: { $ne: 'manager' }, date: { $gte: moveInDate } })
      .sort({ date: -1 })
      .limit(2)
      .lean(),
  ]);

  res.json({
    dueAmount: site?.dueAmount ?? null,
    reports: reports.map((a) => ({
      id: a._id,
      month: a.month,
      year: a.year,
      amount: a.amount,
      paymentMethod: a.paymentMethod,
      note: a.note,
      status: a.status,
      date: a.date,
    })),
  });
});

// POST /api/dues
// Kim kullanabilir: sakin. Kendi dairesi için "aidatı verdim" bildirimi oluşturur (status: 'pending').
// Aynı ay için bekleyen veya onaylanmış bir bildirim varsa yenisi kabul edilmez (409).
// Kayıt oluşunca sitenin yöneticisine "yeni aidat bildirimi" push bildirimi gönderilir.
router.post('/', validate(reportSchema), async (req, res) => {
  const { siteId, flatId } = req.user;
  const { month, year, amount, paymentMethod, note } = req.body;

  if (!withinLast12Months(month, year)) {
    throw new ApiError(400, 'Sadece bu ay ve önceki 11 ay için bildirim gönderilebilir.');
  }

  // Reddedilen bildirimler sayılmaz: reddedilen aya tekrar bildirim gönderilebilir.
  const existing = await Due.findOne({ siteId, flatId, month, year, status: { $in: ['pending', 'approved'] } })
    .select('date')
    .lean();
  if (existing) {
    // Kayıt bu sakin katılmadan önce oluşturulduysa dairenin ÖNCEKİ sakinine aittir (daire el değiştirmiş);
    // sakin o kaydı hiçbir ekranda göremediği için mesaj buna göre verilir. "Katılma" anı daireye giriş tarihidir.
    const moveInDate = User.moveInDateOf(
      await User.findById(req.user.id).select('moveInDate createdAt').lean()
    );
    throw new ApiError(
      409,
      existing.date < moveInDate
        ? 'Bu ay için dairenin önceki sakinine ait bir aidat kaydı var. Lütfen yöneticinizle görüşün.'
        : 'Bu ay için zaten bekleyen veya onaylanmış bir bildiriminiz var.'
    );
  }

  // Math.round(... * 100) / 100: tutarı tam 2 kuruş basamağına yuvarlar (ondalık hatalarını önler).
  // İki istek aynı anda gelip yukarıdaki kontrolü birlikte geçerse, modeldeki unique index ikincisini
  // reddeder (MongoDB 11000 hatası → merkezi hata yakalayıcı 409 döner).
  const due = await Due.create({
    siteId,
    flatId,
    month,
    year,
    amount: Math.round(amount * 100) / 100,
    paymentMethod,
    note,
  });

  // Yöneticiye "yeni aidat bildirimi" push'u gider; bekleyen bildirimleri onaylaması gerektiğini öğrenir.
  // Yönetici, sakinin kendi sitesindeki (token'dan gelen siteId) 'manager' rolündeki kişidir; her sitenin
  // tek yöneticisi vardır. Daire adı (örn. "A5") Daire + Bina kayıtlarından birleştirilir; hepsi siteId ile filtrelenir.
  // Bildirim gönderilemezse aidat bildirimi yine kaydedilmiş sayılır; hata sadece loglanır.
  try {
    const manager = await User.findOne({ siteId, role: 'manager', pushToken: { $ne: null } })
      .select('pushToken')
      .lean();
    if (manager) {
      const flat = await Flat.findOne({ _id: flatId, siteId }).select('buildingId flatNumber').lean();
      const building = flat && (await Building.findOne({ _id: flat.buildingId, siteId }).select('name').lean());
      const flatName = building ? `${building.name}${flat.flatNumber}` : 'Bir daire';
      await sendPush([manager.pushToken], {
        title: 'Yeni aidat bildirimi',
        content: `${flatName}: ${monthText(month, year)} aidatını ödediğini bildirdi. Onay bekliyor.`,
        pushData: { screen: 'PendingPayments' },
      });
    }
  } catch (error) {
    console.error('Aidat bildirimi push gönderilemedi:', error.message);
  }

  res.status(201).json({ id: due._id, status: due.status });
});

module.exports = router;
