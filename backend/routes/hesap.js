// Hesap route'ları: site oluşturma, davet koduyla katılma, giriş, oturum sahibini sorgulama,
// telefonun push bildirim adresini (push token) kaydetme/silme ve hesabı kalıcı olarak silme.
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const Site = require('../models/Site');
const Kullanici = require('../models/Kullanici');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Mesaj = require('../models/Mesaj');
const SilinenHesap = require('../models/SilinenHesap');
const dogrula = require('../middleware/dogrula');
const { kayitSiniri, girisSiniri, kodSiniri } = require('../middleware/denemeSiniri');
const { girisGerekli, DAIREDEN_CIKARILDI } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { davetKodlariUret } = require('../services/davetKodu');
// kullaniciyiKopar: hesap silinince aynı hesabın başka telefonlardaki soket bağlantısını kapatmak için.
const { kullaniciyiKopar } = require('../soket');

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
    // Bu e-postanın eski bir "silinen hesap" izi varsa kaldırılır (kişi yeni hesap açtı, eski mesaj artık geçersiz).
    await SilinenHesap.deleteOne({ epostaOzeti: SilinenHesap.ozet(eposta) }, { session });
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

    // Bu e-postanın eski bir "silinen hesap" izi varsa kaldırılır (kişi yeni dairesine yeni hesapla katıldı).
    await SilinenHesap.deleteOne({ epostaOzeti: SilinenHesap.ozet(eposta) }, { session });
    // siteId ve daireId istekten değil, kodun ait olduğu daireden alınır.
    await Kullanici.create(
      // daireyeGiris: sakinin bu daireye geldiği an; aidat hesapları bu aydan itibaren ödeme bekler.
      [{ _id: kullaniciId, siteId: daire.siteId, daireId: daire._id, daireyeGiris: new Date(), ad, eposta, sifre, rol: 'sakin' }],
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

  // Hesap yoksa ama bu e-posta daireden çıkarıldığı için silinen bir hesaba aitse nedeni söylenir.
  // Yazılan e-postanın özeti (SHA-256) alınıp SilinenHesap izleriyle karşılaştırılır; e-postanın kendisi
  // hiçbir yerde saklanmadığı için iz kişisel bilgi taşımaz. 403 (yasak): giriş bu hesap için artık mümkün değil.
  // Bilinçli tercih (kullanıcı kararı): hesap silindiği için şifre kontrol edilemez; e-postayı bilen biri o kişinin
  // son 30 gün içinde daireden çıkarıldığını öğrenebilir. İz 30 gün sonra silindiği için bu süreyle sınırlıdır.
  if (!kullanici && (await SilinenHesap.exists({ epostaOzeti: SilinenHesap.ozet(eposta) }))) {
    throw new ApiHatasi(403, DAIREDEN_CIKARILDI);
  }
  // E-posta mı şifre mi yanlış, bilinçli olarak söylenmez: saldırgan hangi e-postaların
  // kayıtlı olduğunu öğrenemez.
  if (!kullanici || !sifreDogru) {
    throw new ApiHatasi(401, 'E-posta veya şifre hatalı.');
  }

  // Ek güvenlik: daireye bağlı olmayan sakin giriş yapamaz. Normalde olmaz (daireden çıkarılan sakinin
  // hesabı artık silinir, yukarıdaki SilinenHesap kontrolüne takılır); şifre doğru olduğu için nedeni açıkça söylenir.
  if (kullanici.rol === 'sakin' && !kullanici.daireId) {
    throw new ApiHatasi(403, DAIREDEN_CIKARILDI);
  }

  const bilgi = await oturumBilgisi(kullanici);
  // Sitesi silinmiş bir hesapla giriş yapılamaz (sunucu hata vermesin diye kontrol).
  if (!bilgi) throw new ApiHatasi(401, 'E-posta veya şifre hatalı.');

  res.json({ token: tokenUret(kullanici._id), ...bilgi });
});

// Push token kuralı: Expo'nun verdiği biçimde olmalı (başka bir adrese bildirim gönderilemesin).
const pushTokenSemasi = z.object({
  token: z
    .string({ error: 'Token girilmeli' })
    .max(200, 'Token geçersiz')
    .regex(/^Expo(nent)?PushToken\[.+\]$/, 'Token geçersiz'),
});

// PUT /api/hesap/push-token
// Kim kullanabilir: giriş yapmış herkes. Telefonun push adresini kullanıcının hesabına kaydeder;
// duyuru vb. bildirimler bu adrese gönderilir. Aynı telefon daha önce başka bir hesapta kayıtlıysa
// oradan silinir (telefonda önce A sonra B giriş yaptıysa, A'nın bildirimleri bu telefona gelmesin).
// O temizlikte siteId filtresi bilerek yok: telefon başka sitedeki bir hesapta kayıtlı olabilir.
// Sadece pushToken alanı null yapılır, başka sitenin hiçbir verisi okunmaz veya cevapta gönderilmez.
// Kendi hesabı ise istekten değil token'dan gelen req.kullanici.id ile güncellenir.
router.put('/push-token', girisGerekli, dogrula(pushTokenSemasi), async (req, res) => {
  const { token } = req.body;
  await Kullanici.updateMany({ pushToken: token, _id: { $ne: req.kullanici.id } }, { pushToken: null });
  await Kullanici.updateOne({ _id: req.kullanici.id }, { pushToken: token });
  res.status(204).end();
});

// DELETE /api/hesap/push-token
// Kim kullanabilir: giriş yapmış herkes. Çıkış yaparken çağrılır; bu hesaba artık bildirim gitmez.
router.delete('/push-token', girisGerekli, async (req, res) => {
  await Kullanici.updateOne({ _id: req.kullanici.id }, { pushToken: null });
  res.status(204).end();
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

// Hesap silme formunun kuralı: şifre tekrar girilmeli.
const hesapSilSemasi = z.object({
  sifre: z.string({ error: 'Şifre girilmeli' }).min(1, 'Şifre girilmeli').max(72, 'Şifre çok uzun'),
});

// DELETE /api/hesap
// Kim kullanabilir: giriş yapmış SAKİN (yönetici önce yöneticiliği devretmelidir → 403).
// Hesabı kalıcı olarak siler. Şifre tekrar istenir: telefonu eline alan başka biri hesabı silemesin.
// - Silinenler: kişisel veriler (ad, e-posta, şifre, bildirim adresi; yani hesabın kendisi) ve kişinin mesajları.
// - Korunanlar: aidat kayıtları. Kişiye değil daireye bağlı oldukları için (daireId) yönetici takviminde durmaya devam eder.
// - Daire boşaltılır ve yeni davet kodu alır; dairenin yeni sakini yeni kodla katılır.
// Hepsi tek transaction'da yapılır (ya hepsi ya hiçbiri).
// girisSiniri: şifre karşılaştırıldığı için girişteki deneme sınırı burada da uygulanır (şifre tahminine karşı).
router.delete('/', girisSiniri, girisGerekli, dogrula(hesapSilSemasi), async (req, res) => {
  // id, siteId ve rol istekten değil, girisGerekli'nin token'dan bulduğu veritabanı kaydından gelir.
  const { id, siteId, rol } = req.kullanici;
  // YETKİ KONTROLÜ: mobil ekran yöneticiye silme formunu hiç göstermez ama asıl engel burasıdır.
  // Yönetici silinirse site yöneticisiz kalırdı; bu yüzden önce devir şarttır.
  if (rol === 'yonetici') {
    throw new ApiHatasi(403, 'Yönetici hesabı silinemez. Önce yöneticiliği bir sakine devredin.');
  }

  // select('+sifre'): şifre hash'i normalde sorgulara gelmez, sadece karşılaştırma için alınır.
  // Yanlış şifrede 400 döner (401 değil): 401 telefonda oturumu kapatırdı, kullanıcı sadece tekrar denemeli.
  const kullanici = await Kullanici.findById(id).select('+sifre daireId');
  // Aynı hesap az önce başka bir telefondan silindiyse kayıt yoktur (sunucu hata vermesin diye kontrol).
  if (!kullanici) throw new ApiHatasi(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  if (!(await bcrypt.compare(req.body.sifre, kullanici.sifre))) {
    throw new ApiHatasi(400, 'Şifre hatalı.');
  }

  // Yeni davet kodu başka bir dairenin koduyla çakışırsa (çok düşük ihtimal) unique index 11000 hatası
  // verir ve transaction geri alınır; o durumda yeni kodla en fazla 3 kez denenir.
  for (let deneme = 1; ; deneme++) {
    try {
      await mongoose.connection.transaction(async (session) => {
        // Kişinin gönderdiği ve aldığı tüm mesajlar (siteId filtresiyle).
        await Mesaj.deleteMany({ siteId, $or: [{ gonderenId: id }, { aliciId: id }] }, { session });
        // Hesap kaydı silinir: ad, e-posta, şifre hash'i ve push token birlikte gider. Kayıt olmadığı için
        // bu hesabın token'ı artık hiçbir istekte geçmez (girisGerekli kullanıcıyı bulamaz → 401).
        await Kullanici.deleteOne({ _id: id }, { session });
        // Daire boşaltılır: sakin bağı kaldırılır ve eski kod yerine kullanılmamış yeni bir davet kodu konur.
        // Filtrede siteId de var (site izolasyonu). daireId kontrolü sadece güvenlik önlemi; sakinde hep doludur.
        if (kullanici.daireId) {
          const [yeniKod] = davetKodlariUret(1);
          await Daire.updateOne(
            // sakinId: id → daire gerçekten bu kişiye kayıtlıysa sıfırlanır (bu arada daireye başkası geldiyse dokunulmaz).
            { _id: kullanici.daireId, siteId, sakinId: id },
            { davetKodu: yeniKod, davetKoduKullanildi: false, sakinId: null },
            { session }
          );
        }
      });
      break;
    } catch (hata) {
      if (hata.code === 11000 && deneme < 3) continue;
      throw hata;
    }
  }

  // Aynı hesap başka bir telefonda da açıksa o uygulamaya haber verilir ve bağlantısı kapatılır.
  kullaniciyiKopar(id, 'hesapSilindi', { mesaj: 'Hesabınız ve kişisel bilgileriniz silindi.' });
  // 204: işlem başarılı, cevapta gönderilecek veri yok.
  res.status(204).end();
});

module.exports = router;
