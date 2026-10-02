// Hesap route'ları: site oluşturma, davet koduyla katılma, giriş ve oturum sahibini sorgulama.
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const Site = require('../models/Site');
const Kullanici = require('../models/Kullanici');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const dogrula = require('../middleware/dogrula');
const { kayitSiniri, girisSiniri, kodSiniri } = require('../middleware/denemeSiniri');
const { girisGerekli } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');

const router = express.Router();

// Giriş yapan kullanıcıya verilen JWT (kimlik kartı). İçinde sadece kullanıcı id'si var;
// site ve rol bilgisi her istekte veritabanından okunur (eski/sahte bilgiye güvenilmez).
// 7 gün sonra geçersiz olur, kullanıcı tekrar giriş yapar.
function tokenUret(kullaniciId) {
  return jwt.sign({ id: kullaniciId }, process.env.JWT_ANAHTARI, { expiresIn: '7d' });
}

// Giriş, katılma ve otomatik giriş route'larının ortak cevabı: kullanıcı, site ve (sakinse) daire.
// Site ve daire, kullanıcının kendi siteId/daireId'si ile aranır (site izolasyonu).
// Site silinmişse null döner; route'lar bunu "oturum geçersiz" sayar.
async function oturumBilgisi(kullanici) {
  const site = await Site.findById(kullanici.siteId).lean();
  if (!site) return null;

  let daire = null;
  if (kullanici.daireId) {
    const d = await Daire.findOne({ _id: kullanici.daireId, siteId: kullanici.siteId }).lean();
    const bina = d && (await Bina.findOne({ _id: d.binaId, siteId: kullanici.siteId }).lean());
    if (bina) daire = { id: d._id, ad: `${bina.ad}${d.daireNo}` }; // örn. "A3"
  }

  return {
    // _id: veritabanı kaydından gelirse; id: girisGerekli'nin hazırladığı req.kullanici'dan gelirse.
    kullanici: { id: kullanici._id ?? kullanici.id, ad: kullanici.ad, eposta: kullanici.eposta, rol: kullanici.rol },
    site: { id: site._id, ad: site.ad },
    daire,
  };
}

// Hesap formlarındaki ortak alan kuralları: boş alan, geçersiz e-posta, kısa şifre kabul edilmez.
// Şifre en fazla 72 karakter: bcrypt 72 bayttan sonrasını dikkate almaz.
const hesapAlanlari = {
  ad: z.string({ error: 'Ad girilmeli' }).trim().min(2, 'Ad en az 2 karakter olmalı').max(50, 'Ad en fazla 50 karakter olabilir'),
  // Önce boşluklar silinip küçük harfe çevrilir, sonra e-posta biçimi kontrol edilir.
  eposta: z.string({ error: 'E-posta girilmeli' }).trim().toLowerCase().max(254, 'E-posta çok uzun').pipe(z.email('Geçerli bir e-posta adresi girin')),
  sifre: z.string({ error: 'Şifre girilmeli' }).min(8, 'Şifre en az 8 karakter olmalı').max(72, 'Şifre en fazla 72 karakter olabilir'),
};

// Site oluşturma formu: hesap alanları + site adı.
const siteOlusturSemasi = z.object({
  ...hesapAlanlari,
  siteAdi: z.string({ error: 'Site adı girilmeli' }).trim().min(2, 'Site adı en az 2 karakter olmalı').max(80, 'Site adı en fazla 80 karakter olabilir'),
});

// POST /api/hesap/site-olustur
// Kim kullanabilir: herkes (giriş gerekmez). Yeni bir site ve o sitenin yönetici hesabını
// oluşturur, giriş için token döner. kayitSiniri: aynı IP'den çok sayıda hesap açılmasını engeller.
// dogrula: gövdeyi yukarıdaki şemayla kontrol eder; uymazsa route'a hiç girilmeden 400 döner.
// Sıra önemli: önce deneme sınırı, sonra doğrulama; sınırı aşan istek hiç doğrulanmaz.
router.post('/site-olustur', kayitSiniri, dogrula(siteOlusturSemasi), async (req, res) => {
  const { ad, eposta, sifre, siteAdi } = req.body;

  // Site yöneticiyi, yönetici de siteyi gösterdiği için iki id önceden üretilir.
  const siteId = new mongoose.Types.ObjectId();
  const kullaniciId = new mongoose.Types.ObjectId();

  // Transaction: site ve kullanıcı ya birlikte kaydedilir ya hiç kaydedilmez.
  // Örneğin e-posta zaten kayıtlıysa yarım kalmış, yöneticisiz bir site oluşmaz.
  await mongoose.connection.transaction(async (session) => {
    await Site.create([{ _id: siteId, ad: siteAdi, yoneticiId: kullaniciId }], { session });
    await Kullanici.create(
      [{ _id: kullaniciId, siteId, ad, eposta, sifre, rol: 'yonetici' }],
      { session }
    );
  });

  // 201: yeni kayıt oluşturuldu. Şifre hash'i cevaba hiç eklenmez.
  res.status(201).json({
    token: tokenUret(kullaniciId),
    kullanici: { id: kullaniciId, ad, eposta, rol: 'yonetici' },
    site: { id: siteId, ad: siteAdi },
    daire: null, // yöneticinin dairesi yok
  });
});

// Davet koduyla katılma formu: 6 haneli kod + hesap alanları.
const katilSemasi = z.object({
  davetKodu: z
    .string({ error: 'Davet kodu girilmeli' })
    .trim()
    .regex(/^\d{6}$/, 'Davet kodu 6 haneli bir sayı olmalı'),
  ...hesapAlanlari,
});

// POST /api/hesap/katil
// Kim kullanabilir: herkes (giriş gerekmez). Sakin dairesinin davet koduyla hesap açar;
// hesap kodun ait olduğu siteye ve daireye otomatik bağlanır. kodSiniri: kod tahmin etmeye
// çalışan hatalı denemeleri sınırlar. Sıra yine önemli: önce deneme sınırı, sonra dogrula.
router.post('/katil', kodSiniri, dogrula(katilSemasi), async (req, res) => {
  const { davetKodu, ad, eposta, sifre } = req.body;
  const kullaniciId = new mongoose.Types.ObjectId();

  // Transaction: kodu "kullanıldı" yapmak ve hesabı açmak birlikte olur. Hesap açılamazsa
  // (örn. e-posta zaten kayıtlı) kod da kullanılmamış haline geri döner.
  await mongoose.connection.transaction(async (session) => {
    // TEK KULLANIMLIK KOD: "kullanılmamış bu kodu bul VE kullanıldı yap" tek bir veritabanı
    // işlemidir. Aynı kodu aynı anda iki kişi gönderse bile sadece biri başarılı olur.
    // $ne: true → "true olmayan": alan false olan VE bu alan eklenmeden önce oluşturulmuş
    // (alanı hiç olmayan) daireler de bulunur.
    // returnDocument: 'after' → güncellenmiş daire döner; session → işlem transaction'ın parçası olur.
    const daire = await Daire.findOneAndUpdate(
      { davetKodu, davetKoduKullanildi: { $ne: true } },
      { davetKoduKullanildi: true, sakinId: kullaniciId },
      { session, returnDocument: 'after' }
    );
    // Kod yoksa da kullanılmışsa da aynı mesaj: hangi kodların var olduğu belli edilmez.
    if (!daire) {
      throw new ApiHatasi(400, 'Davet kodu geçersiz veya kullanılmış.');
    }

    // siteId ve daireId istekten değil, kodun ait olduğu daireden alınır.
    await Kullanici.create(
      [{ _id: kullaniciId, siteId: daire.siteId, daireId: daire._id, ad, eposta, sifre, rol: 'sakin' }],
      { session }
    );
  });

  // Cevap giriş route'uyla aynı biçimdedir (token + kullanıcı + site + daire); mobil uygulama
  // bununla sakini doğrudan oturum açmış olarak sakin ana ekranına geçirir.
  const kullanici = await Kullanici.findById(kullaniciId).lean();
  const bilgi = await oturumBilgisi(kullanici);
  // Site bu arada silinmişse (çok düşük ihtimal) eksik cevap gönderilmez.
  if (!bilgi) throw new ApiHatasi(400, 'Davet kodu geçersiz veya kullanılmış.');
  res.status(201).json({ token: tokenUret(kullaniciId), ...bilgi });
});

// Giriş formunun kuralları. Şifrede uzunluk kuralı yok: yanlış şifre zaten aşağıda reddedilir.
const girisSemasi = z.object({
  eposta: z.string({ error: 'E-posta girilmeli' }).trim().toLowerCase().max(254, 'E-posta çok uzun'),
  sifre: z.string({ error: 'Şifre girilmeli' }).min(1, 'Şifre girilmeli').max(72, 'Şifre çok uzun'),
});

// Kullanıcı bulunamazsa da bcrypt karşılaştırması yapılsın diye kullanılan sahte hash.
// Böylece cevap süresi "böyle bir e-posta var mı" bilgisini sızdırmaz.
// Sunucu açılırken bir kez üretilir (gerçek bir hash olmalı ki karşılaştırma gerçekten yapılsın).
const SAHTE_HASH = bcrypt.hashSync('kullanici-yok', 12);

// POST /api/hesap/giris
// Kim kullanabilir: herkes. E-posta ve şifre doğruysa token ve kullanıcı/site bilgisini döner.
// girisSiniri: hatalı denemeleri sınırlar (şifre tahmin saldırısına karşı).
// Sıra yine önemli: önce deneme sınırı, sonra dogrula ile gövde kontrolü.
router.post('/giris', girisSiniri, dogrula(girisSemasi), async (req, res) => {
  const { eposta, sifre } = req.body;

  // select('+sifre'): şifre hash'i normalde sorgulara gelmez, sadece burada karşılaştırma için alınır.
  const kullanici = await Kullanici.findOne({ eposta }).select('+sifre');
  // bcrypt.compare: girilen şifreyi hash'leyip kayıtlı hash ile karşılaştırır (şifre çözülmez).
  const sifreDogru = await bcrypt.compare(sifre, kullanici?.sifre ?? SAHTE_HASH);

  // E-posta mı şifre mi yanlış, bilinçli olarak söylenmez: saldırgan hangi e-postaların
  // kayıtlı olduğunu öğrenemez.
  if (!kullanici || !sifreDogru) {
    throw new ApiHatasi(401, 'E-posta veya şifre hatalı.');
  }

  const bilgi = await oturumBilgisi(kullanici);
  // Sitesi silinmiş bir hesapla giriş yapılamaz (sunucu hata vermesin diye kontrol).
  if (!bilgi) throw new ApiHatasi(401, 'E-posta veya şifre hatalı.');

  res.json({ token: tokenUret(kullanici._id), ...bilgi });
});

// GET /api/hesap/ben
// Kim kullanabilir: giriş yapmış herkes. Token'ın sahibini, sitesini ve (sakinse) dairesini döner.
// Mobil uygulama açılışta kayıtlı token'ın hâlâ geçerli olup olmadığını bununla kontrol eder.
router.get('/ben', girisGerekli, async (req, res) => {
  // Bilgiler girisGerekli'nin veritabanından doldurduğu req.kullanici'dan alınır, istekten değil.
  const bilgi = await oturumBilgisi(req.kullanici);
  // Site silinmişse oturum geçersiz sayılır; mobil uygulama kayıtlı token'ı siler.
  if (!bilgi) throw new ApiHatasi(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');

  res.json(bilgi);
});

module.exports = router;
