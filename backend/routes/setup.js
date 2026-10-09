// Kurulum route'ları: yöneticinin sitedeki binaları ve daireleri bir kerede oluşturması
// ve sitenin aylık aidat tutarını belirlemesi.
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const Site = require('../models/Site');
const Due = require('../models/Due');
const validate = require('../middleware/validate');
const { amountRule } = require('../middleware/validate');
const { requireAuth, managerOnly } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
// Davet kodu üretici ortak servisten gelir: sakini daireden çıkarma route'u da aynı fonksiyonu kullanır.
const { generateInviteCodes } = require('../services/inviteCode');

const router = express.Router();

// Bu dosyadaki tüm route'lar sadece giriş yapmış YÖNETİCİ içindir.
// siteId her zaman req.kullanici'dan (veritabanından) alınır, istekten asla alınmaz.
router.use(requireAuth, managerOnly);

// Bina adları için harfler: en fazla 26 bina olabilir (A–Z).
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Alan hiç gönderilmediyse "girilmeli", sayı yerine başka bir şey geldiyse "sayı olmalı" der.
const numberError = (field) => (issue) =>
  issue.input === undefined ? `${field} girilmeli` : `${field} bir sayı olmalı`;

// Kurulum formunun kuralları: iki tam sayı. Mobil ekran da en fazla 2 hane kabul eder.
const setupSchema = z.object({
  binaSayisi: z
    .number({ error: numberError('Bina sayısı') })
    .int('Bina sayısı tam sayı olmalı')
    .min(1, 'En az 1 bina olmalı')
    .max(26, 'En fazla 26 bina olabilir (A–Z)'),
  daireSayisi: z
    .number({ error: numberError('Daire sayısı') })
    .int('Daire sayısı tam sayı olmalı')
    .min(1, 'Her binada en az 1 daire olmalı')
    .max(99, 'Bir binada en fazla 99 daire olabilir'),
});

// GET /api/kurulum
// Kim kullanabilir: yönetici. Kendi sitesindeki bina ve daire sayısını, aylık aidat tutarını ve
// onay bekleyen aidat bildirimi sayısını döner.
// Ana ekran kurulumun yapılıp yapılmadığını ve özetini bununla gösterir.
router.get('/', async (req, res) => {
  const { siteId } = req.kullanici;
  const [buildingCount, flatCount, site, pendingCount] = await Promise.all([
    Building.countDocuments({ siteId }),
    Flat.countDocuments({ siteId }),
    Site.findById(siteId).select('aidatTutari').lean(),
    Due.countDocuments({ siteId, durum: 'bekliyor' }),
  ]);
  res.json({ binaSayisi: buildingCount, daireSayisi: flatCount, aidatTutari: site?.aidatTutari ?? null, bekleyenSayisi: pendingCount });
});

// PUT /api/kurulum/aidat-tutari
// Kim kullanabilir: yönetici. Sitenin aylık aidat tutarını belirler veya değiştirir.
// Yeni tutar sadece bundan sonraki bildirimlerde formda hazır gelir; eski bildirimler değişmez.
router.put('/aidat-tutari', validate(z.object({ aidatTutari: amountRule })), async (req, res) => {
  const dueAmount = Math.round(req.body.aidatTutari * 100) / 100; // tam 2 kuruş basamağı
  // Sadece yöneticinin KENDİ sitesi güncellenir (siteId token'dan).
  await Site.updateOne({ _id: req.kullanici.siteId }, { aidatTutari: dueAmount });
  res.json({ aidatTutari: dueAmount });
});

// POST /api/kurulum
// Kim kullanabilir: yönetici. Girilen sayılara göre binaları (A, B, C...) ve daireleri
// (A1, A2... C12) oluşturur, her daireye benzersiz davet kodu verir. Sadece BİR KEZ yapılabilir.
router.post('/', validate(setupSchema), async (req, res) => {
  const { siteId } = req.kullanici;
  const { binaSayisi: buildingCount, daireSayisi: flatCount } = req.body;

  // Kurulum zaten yapılmışsa tekrar yapılmaz (daireler ve kodları değişmesin).
  // 409 (çakışma): istek geçerli ama mevcut durumla çelişiyor. Express 5 async fonksiyondaki
  // throw'u kendisi yakalar ve merkezi hata yakalayıcıya gönderir, try/catch gerekmez.
  if (await Building.exists({ siteId })) {
    throw new ApiError(409, 'Bu sitenin kurulumu zaten yapılmış.');
  }

  // Davet kodu başka bir sitedeki kodla çakışırsa (çok düşük ihtimal) unique index hata verir;
  // o durumda yeni kodlarla en fazla 3 kez yeniden denenir.
  for (let attempt = 1; ; attempt++) {
    try {
      // Transaction: binalar ve daireler ya hep birlikte oluşur ya hiç oluşmaz.
      await mongoose.connection.transaction(async (session) => {
        const buildings = await Building.insertMany(
          LETTERS.slice(0, buildingCount).split('').map((name) => ({ siteId, ad: name })),
          { session }
        );

        const codes = generateInviteCodes(buildingCount * flatCount);
        // Her bina için 1'den flatCount'a kadar daire; kodlar sırayla dağıtılır.
        const flats = buildings.flatMap((building, b) =>
          Array.from({ length: flatCount }, (_, i) => ({
            siteId,
            binaId: building._id,
            daireNo: i + 1,
            davetKodu: codes[b * flatCount + i],
          }))
        );
        await Flat.insertMany(flats, { session });
      });
      break; // başarılı: döngüden çık
    } catch (error) {
      // 11000: MongoDB'nin "benzersiz alan tekrarlandı" hata kodu. Sadece davet kodu çakışmasında
      // yeniden denenir; başka bir hata (örn. aynı anda gelen ikinci kurulum) hemen fırlatılır.
      if (error.code === 11000 && /davetKodu/.test(error.message) && attempt < 3) continue;
      throw error;
    }
  }

  // 201: kayıtlar oluşturuldu.
  res.status(201).json({ binaSayisi: buildingCount, daireSayisi: buildingCount * flatCount });
});

module.exports = router;
