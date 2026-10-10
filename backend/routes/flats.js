// Daire route'ları: yöneticinin sitesindeki daireleri ve davet kodlarını görmesi, sakini daireden çıkarması.
const express = require('express');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const User = require('../models/User');
const { requireAuth, managerOnly, REMOVED_FROM_FLAT } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { disconnectUser } = require('../socket');
const { detachResident } = require('../services/flat');

const router = express.Router();

// Davet kodları gizli bilgidir: sadece giriş yapmış YÖNETİCİ görebilir.
// router.use: bu dosyadaki tüm route'lardan önce çalışır. Sıra önemli: önce requireAuth
// token'ı doğrulayıp req.user'ı doldurur, sonra managerOnly bu bilgiden rolü kontrol eder.
router.use(requireAuth, managerOnly);

// GET /api/flats
// Kim kullanabilir: yönetici. Kendi sitesindeki binaları, her binanın içinde daireleriyle
// (numara, davet kodu, dolu mu, sakinin adı) sıralı olarak döner. siteId token'dan alınır; başka sitenin
// dairesi bu sorguya hiçbir şekilde giremez.
router.get('/', async (req, res) => {
  const { siteId } = req.user;

  // Sorgular aynı anda çalışır (Promise.all), sonuçlar sıralı gelir: binalar A→Z, daireler 1→n.
  // Sakinler de alınır: daireye dokununca yönetici dairede kimin oturduğunu görsün (çıkarmadan önce).
  const [buildings, flats, residents] = await Promise.all([
    Building.find({ siteId }).sort({ name: 1 }).lean(),
    Flat.find({ siteId }).sort({ flatNumber: 1 }).select('buildingId flatNumber inviteCode inviteCodeUsed').lean(),
    // Daireye bağlı tüm hesaplar: sakinler ve (devirle yönetici olduysa) dairesinde oturan yönetici.
    User.find({ siteId, flatId: { $ne: null } }).select('name role flatId').lean(),
  ]);
  // flatId → o dairedeki kişi (Map: her daire için ayrı sorgu atmadan hızlıca bulmak için).
  const person = new Map(residents.map((k) => [String(k.flatId), k]));

  // Daireler kendi binasının altına yerleştirilir; mobil ekran bina bina listeler.
  // buildingId bir ObjectId (nesne) olduğu için === ile değil .equals() ile karşılaştırılır.
  // Async hata olursa Express 5 onu kendiliğinden merkezi hata yakalayıcıya iletir.
  const result = buildings.map((building) => ({
    id: building._id,
    name: building.name,
    flats: flats
      .filter((d) => d.buildingId.equals(building._id))
      .map((d) => ({
        id: d._id,
        flatNumber: d.flatNumber,
        inviteCode: d.inviteCode,
        occupied: d.inviteCodeUsed, // kod kullanıldıysa dairede kayıtlı bir sakin var
        residentName: person.get(String(d._id))?.name ?? null,
        // managerFlat: dairede sitenin yöneticisi oturuyor; ekranda "Sakini çıkar" butonu gösterilmez.
        managerFlat: person.get(String(d._id))?.role === 'manager',
      })),
  }));

  res.json(result);
});

// POST /api/flats/:id/remove-resident
// Kim kullanabilir: yönetici. Daire el değiştirdiğinde eski sakini daireden çıkarır ve daireye YENİ davet kodu verir:
// - Sakinin hesabı ve mesajları tamamen silinir (kişisel veri kalmaz). Geriye sadece e-postanın geri çevrilemez
//   özetinden oluşan, 30 gün sonra kendiliğinden silinen bir iz kalır (DeletedAccount): kişi giriş yapmaya
//   çalışınca "Daireden çıkarıldığınız için hesabınız silinmiştir" mesajını görür. Aynı e-postayla yeni hesap açabilir.
// - Telefonu açıksa soket ile haber verilir ve bağlantısı kapatılır; uygulama oturumu hemen kapatır.
// - Eski davet kodu geçersiz olur; yeni sakin yeni kodla katılır.
// - Dairenin aidat geçmişi SİLİNMEZ (site için gerekli kayıt); yönetici takvimde görmeye devam eder.
// Daire sorgusunda siteId olduğu için başka sitenin dairesi bulunamaz (404).
router.post('/:id/remove-resident', async (req, res) => {
  const { siteId } = req.user;
  const flat = await Flat.findOne({ _id: req.params.id, siteId }).lean();
  if (!flat) throw new ApiError(404, 'Daire bulunamadı.');
  if (!flat.inviteCodeUsed) throw new ApiError(400, 'Bu dairede kayıtlı bir sakin yok.');
  // Dairede yönetici oturuyorsa çıkarılamaz (yönetici önce yöneticiliği devretmeli); dairenin kaydı bozulmasın.
  if (await User.exists({ siteId, role: 'manager', flatId: flat._id })) {
    throw new ApiError(400, 'Bu daire site yöneticisine ait; yönetici daireden çıkarılamaz.');
  }

  // Dairedeki sakin (siteId ve flatId ile). Normalde hep bulunur (sakin hesabını kendisi silseydi daire zaten
  // boşaltılmış olurdu ve yukarıdaki 400 dönerdi). Kayıt tutarsızsa ve sakin bulunamazsa sadece daire sıfırlanır.
  const resident = await User.findOne({ siteId, role: 'resident', flatId: flat._id }).select('email').lean();

  // Sakinin hesabı ve mesajları silinir, iz bırakılır (leaveTrace: true), daire boşaltılıp yeni kod alır.
  // Hepsi tek transaction'da yapılır; ayrıntılar services/flat.js içindeki detachResident'ta.
  const newCode = await detachResident({ siteId, resident, leaveTrace: true, flatFilter: { _id: flat._id } });

  // Soket haberi veritabanı güncellendikten SONRA gönderilir: telefon tekrar bağlanmayı/istek atmayı
  // denerse requireAuth artık onu reddeder. Yeni kod cevapla döner, yöneticinin ekranında hemen görünür.
  if (resident) disconnectUser(resident._id, 'removedFromFlat', { message: REMOVED_FROM_FLAT });
  res.json({ inviteCode: newCode });
});

module.exports = router;
