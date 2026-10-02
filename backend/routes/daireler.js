// Daire route'ları: yöneticinin sitesindeki daireleri ve davet kodlarını görmesi.
const express = require('express');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');

const router = express.Router();

// Davet kodları gizli bilgidir: sadece giriş yapmış YÖNETİCİ görebilir.
// router.use: bu dosyadaki tüm route'lardan önce çalışır. Sıra önemli: önce girisGerekli
// token'ı doğrulayıp req.kullanici'yi doldurur, sonra sadeceYonetici bu bilgiden rolü kontrol eder.
router.use(girisGerekli, sadeceYonetici);

// GET /api/daireler
// Kim kullanabilir: yönetici. Kendi sitesindeki binaları, her binanın içinde daireleriyle
// (numara + davet kodu) sıralı olarak döner. siteId token'dan alınır; başka sitenin
// dairesi bu sorguya hiçbir şekilde giremez.
router.get('/', async (req, res) => {
  const { siteId } = req.kullanici;

  // İki sorgu aynı anda çalışır (Promise.all), sonuçlar sıralı gelir: binalar A→Z, daireler 1→n.
  const [binalar, daireler] = await Promise.all([
    Bina.find({ siteId }).sort({ ad: 1 }).lean(),
    Daire.find({ siteId }).sort({ daireNo: 1 }).select('binaId daireNo davetKodu').lean(),
  ]);

  // Daireler kendi binasının altına yerleştirilir; mobil ekran bina bina listeler.
  // binaId bir ObjectId (nesne) olduğu için === ile değil .equals() ile karşılaştırılır.
  // Async hata olursa Express 5 onu kendiliğinden merkezi hata yakalayıcıya iletir.
  const sonuc = binalar.map((bina) => ({
    id: bina._id,
    ad: bina.ad,
    daireler: daireler
      .filter((d) => d.binaId.equals(bina._id))
      .map((d) => ({ id: d._id, daireNo: d.daireNo, davetKodu: d.davetKodu })),
  }));

  res.json(sonuc);
});

module.exports = router;
