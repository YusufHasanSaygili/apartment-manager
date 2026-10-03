// Kurulum route'ları: yöneticinin sitedeki binaları ve daireleri bir kerede oluşturması
// ve sitenin aylık aidat tutarını belirlemesi.
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Site = require('../models/Site');
const Aidat = require('../models/Aidat');
const dogrula = require('../middleware/dogrula');
const { tutarKurali } = require('../middleware/dogrula');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
// Davet kodu üretici ortak servisten gelir: sakini daireden çıkarma route'u da aynı fonksiyonu kullanır.
const { davetKodlariUret } = require('../services/davetKodu');

const router = express.Router();

// Bu dosyadaki tüm route'lar sadece giriş yapmış YÖNETİCİ içindir.
// siteId her zaman req.kullanici'dan (veritabanından) alınır, istekten asla alınmaz.
router.use(girisGerekli, sadeceYonetici);

// Bina adları için harfler: en fazla 26 bina olabilir (A–Z).
const HARFLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Alan hiç gönderilmediyse "girilmeli", sayı yerine başka bir şey geldiyse "sayı olmalı" der.
const sayiHatasi = (alan) => (sorun) =>
  sorun.input === undefined ? `${alan} girilmeli` : `${alan} bir sayı olmalı`;

// Kurulum formunun kuralları: iki tam sayı. Mobil ekran da en fazla 2 hane kabul eder.
const kurulumSemasi = z.object({
  binaSayisi: z
    .number({ error: sayiHatasi('Bina sayısı') })
    .int('Bina sayısı tam sayı olmalı')
    .min(1, 'En az 1 bina olmalı')
    .max(26, 'En fazla 26 bina olabilir (A–Z)'),
  daireSayisi: z
    .number({ error: sayiHatasi('Daire sayısı') })
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
  const [binaSayisi, daireSayisi, site, bekleyenSayisi] = await Promise.all([
    Bina.countDocuments({ siteId }),
    Daire.countDocuments({ siteId }),
    Site.findById(siteId).select('aidatTutari').lean(),
    Aidat.countDocuments({ siteId, durum: 'bekliyor' }),
  ]);
  res.json({ binaSayisi, daireSayisi, aidatTutari: site?.aidatTutari ?? null, bekleyenSayisi });
});

// PUT /api/kurulum/aidat-tutari
// Kim kullanabilir: yönetici. Sitenin aylık aidat tutarını belirler veya değiştirir.
// Yeni tutar sadece bundan sonraki bildirimlerde formda hazır gelir; eski bildirimler değişmez.
router.put('/aidat-tutari', dogrula(z.object({ aidatTutari: tutarKurali })), async (req, res) => {
  const aidatTutari = Math.round(req.body.aidatTutari * 100) / 100; // tam 2 kuruş basamağı
  // Sadece yöneticinin KENDİ sitesi güncellenir (siteId token'dan).
  await Site.updateOne({ _id: req.kullanici.siteId }, { aidatTutari });
  res.json({ aidatTutari });
});

// POST /api/kurulum
// Kim kullanabilir: yönetici. Girilen sayılara göre binaları (A, B, C...) ve daireleri
// (A1, A2... C12) oluşturur, her daireye benzersiz davet kodu verir. Sadece BİR KEZ yapılabilir.
router.post('/', dogrula(kurulumSemasi), async (req, res) => {
  const { siteId } = req.kullanici;
  const { binaSayisi, daireSayisi } = req.body;

  // Kurulum zaten yapılmışsa tekrar yapılmaz (daireler ve kodları değişmesin).
  // 409 (çakışma): istek geçerli ama mevcut durumla çelişiyor. Express 5 async fonksiyondaki
  // throw'u kendisi yakalar ve merkezi hata yakalayıcıya gönderir, try/catch gerekmez.
  if (await Bina.exists({ siteId })) {
    throw new ApiHatasi(409, 'Bu sitenin kurulumu zaten yapılmış.');
  }

  // Davet kodu başka bir sitedeki kodla çakışırsa (çok düşük ihtimal) unique index hata verir;
  // o durumda yeni kodlarla en fazla 3 kez yeniden denenir.
  for (let deneme = 1; ; deneme++) {
    try {
      // Transaction: binalar ve daireler ya hep birlikte oluşur ya hiç oluşmaz.
      await mongoose.connection.transaction(async (session) => {
        const binalar = await Bina.insertMany(
          HARFLER.slice(0, binaSayisi).split('').map((ad) => ({ siteId, ad })),
          { session }
        );

        const kodlar = davetKodlariUret(binaSayisi * daireSayisi);
        // Her bina için 1'den daireSayisi'na kadar daire; kodlar sırayla dağıtılır.
        const daireler = binalar.flatMap((bina, b) =>
          Array.from({ length: daireSayisi }, (_, i) => ({
            siteId,
            binaId: bina._id,
            daireNo: i + 1,
            davetKodu: kodlar[b * daireSayisi + i],
          }))
        );
        await Daire.insertMany(daireler, { session });
      });
      break; // başarılı: döngüden çık
    } catch (hata) {
      // 11000: MongoDB'nin "benzersiz alan tekrarlandı" hata kodu. Sadece davet kodu çakışmasında
      // yeniden denenir; başka bir hata (örn. aynı anda gelen ikinci kurulum) hemen fırlatılır.
      if (hata.code === 11000 && /davetKodu/.test(hata.message) && deneme < 3) continue;
      throw hata;
    }
  }

  // 201: kayıtlar oluşturuldu.
  res.status(201).json({ binaSayisi, daireSayisi: binaSayisi * daireSayisi });
});

module.exports = router;
