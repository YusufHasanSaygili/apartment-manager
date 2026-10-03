// Yönetici devri route'ları: yönetici, sitedeki bir dairenin sakinini yeni yönetici yapar; kendisi sakin olur.
// Site sıfırdan kurulmaz: daireler, aidat geçmişi, duyurular ve sakin hesapları olduğu gibi kalır.
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Kullanici = require('../models/Kullanici');
const Site = require('../models/Site');
const dogrula = require('../middleware/dogrula');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { kullaniciyaGonder } = require('../soket');
const { pushGonder } = require('../services/bildirim');

const router = express.Router();

// Devir sadece sitenin YÖNETİCİSİ tarafından yapılabilir. siteId ve yöneticinin kimliği token'dan alınır.
router.use(girisGerekli, sadeceYonetici);

// Daire adlarını ("B12") hesaplamak için: daireId → ad eşlemesi (Map) döner. Tüm sorgular siteId ile filtrelenir.
async function daireAdlari(siteId) {
  const [binalar, daireler] = await Promise.all([
    Bina.find({ siteId }).select('ad').lean(),
    Daire.find({ siteId }).select('binaId daireNo').lean(),
  ]);
  const binaAdi = new Map(binalar.map((b) => [String(b._id), b.ad]));
  return new Map(daireler.map((d) => [String(d._id), `${binaAdi.get(String(d.binaId))}${d.daireNo}`]));
}

// "A2" "A10"dan önce gelsin diye sayısal (numeric) sıralama.
const adaGore = (a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true });

// GET /api/devir/secenekler
// Kim kullanabilir: yönetici. Devir ekranının ihtiyaç duyduğu listeleri döner:
// - adaylar: sakini olan daireler (yeni yönetici bunlardan biri olur), örn. { daireId, ad: "B12", sakinAdi: "Ahmet" }
// - kendiDairem: yöneticinin kayıtlı dairesi (daha önce devirle yönetici olduysa); devirden sonra buraya sakin olur
// - bosDaireler: kendiDairem yoksa (siteyi kuran yönetici), devirden sonra oturacağı daireyi seçmesi için içinde kimse
//   kayıtlı olmayan daireler
router.get('/secenekler', async (req, res) => {
  const { id, siteId } = req.kullanici;
  const [adlar, kayitlilar, ben] = await Promise.all([
    daireAdlari(siteId),
    // Bir daireye bağlı tüm hesaplar (sakinler ve dairesi olan yönetici): "boş daire" bulmak için.
    Kullanici.find({ siteId, daireId: { $ne: null } }).select('ad rol daireId').lean(),
    Kullanici.findById(id).select('daireId').lean(),
  ]);

  const adaylar = kayitlilar
    .filter((k) => k.rol === 'sakin')
    .map((k) => ({ daireId: k.daireId, ad: adlar.get(String(k.daireId)) ?? '—', sakinAdi: k.ad }))
    .sort(adaGore);

  const kendiDairem = ben.daireId ? { id: ben.daireId, ad: adlar.get(String(ben.daireId)) ?? '—' } : null;

  // Set: içinde kayıtlı biri olan dairelerin kimlikleri; geri kalanlar boştur.
  const doluDaireler = new Set(kayitlilar.map((k) => String(k.daireId)));
  const bosDaireler = kendiDairem
    ? []
    : [...adlar].filter(([daireId]) => !doluDaireler.has(daireId)).map(([daireId, ad]) => ({ id: daireId, ad })).sort(adaGore);

  res.json({ adaylar, kendiDairem, bosDaireler });
});

// Devir formunun kuralları: daire kimlikleri MongoDB kimliği biçiminde (24 karakter onaltılık) olmalı.
// kendiDaireId sadece yöneticinin kayıtlı dairesi yoksa gerekir.
const kimlik = z.string().regex(/^[a-f\d]{24}$/i, 'Daire geçersiz');
const devirSemasi = z.object({
  yeniYoneticiDaireId: kimlik,
  kendiDaireId: kimlik.optional(),
});

// POST /api/devir
// Kim kullanabilir: sitenin yöneticisi. Seçilen dairenin sakinini yeni yönetici yapar, kendisi sakin olur.
// - Yeni yönetici: o dairenin sakini (siteId ile aranır; başka sitenin kişisi bulunamaz → 404).
// - Eski yönetici: kayıtlı dairesi varsa oraya, yoksa seçtiği BOŞ daireye sakin olarak bağlanır.
// Tüm değişiklikler tek transaction'da yapılır (ya hepsi olur ya hiçbiri); yarım kalmış devir olmaz.
router.post('/', dogrula(devirSemasi), async (req, res) => {
  const { id, siteId } = req.kullanici;
  const { yeniYoneticiDaireId, kendiDaireId } = req.body;

  const yeniYonetici = await Kullanici.findOne({ siteId, rol: 'sakin', daireId: yeniYoneticiDaireId })
    .select('ad pushToken')
    .lean();
  if (!yeniYonetici) throw new ApiHatasi(404, 'Seçilen dairede kayıtlı bir sakin bulunamadı.');

  // Eski yöneticinin devirden sonra oturacağı daire.
  const ben = await Kullanici.findById(id).select('daireId').lean();
  let hedefDaireId = ben.daireId;
  if (!hedefDaireId) {
    if (!kendiDaireId) throw new ApiHatasi(400, 'Devirden sonra oturacağınız daireyi seçin.');
    const daire = await Daire.findOne({ _id: kendiDaireId, siteId }).select('_id').lean();
    if (!daire) throw new ApiHatasi(404, 'Daire bulunamadı.');
    // Seçilen dairede başka biri kayıtlıysa oraya bağlanılamaz (bir dairede tek hesap).
    if (await Kullanici.exists({ siteId, daireId: daire._id })) {
      throw new ApiHatasi(400, 'Seçtiğiniz dairede kayıtlı biri var. Boş bir daire seçin.');
    }
    hedefDaireId = daire._id;
  }

  // Transaction: dört güncelleme birlikte yapılır. İçeride hata fırlatılırsa hepsi geri alınır.
  await mongoose.connection.transaction(async (session) => {
    // Sitenin yöneticisi değişir. Filtrede yoneticiId: id var: aynı anda iki devir denenirse ikincisi
    // hiçbir şeyi değiştiremez (modifiedCount 0) ve 409 alır.
    const site = await Site.updateOne({ _id: siteId, yoneticiId: id }, { yoneticiId: yeniYonetici._id }, { session });
    if (site.modifiedCount === 0) throw new ApiHatasi(409, 'Yöneticilik zaten devredilmiş.');

    // Yeni yönetici: rolü değişir, dairesi (daireId) kayıtlı kalır; ileride devrederse oraya döner.
    // Filtrede "hâlâ o dairenin sakini" şartı var: kişi bu arada daireden çıkarıldıysa hiçbir şey değişmez,
    // hata fırlatılır ve transaction tüm değişiklikleri geri alır.
    const yeni = await Kullanici.updateOne(
      { _id: yeniYonetici._id, siteId, rol: 'sakin', daireId: yeniYoneticiDaireId },
      { rol: 'yonetici' },
      { session }
    );
    if (yeni.modifiedCount === 0) throw new ApiHatasi(409, 'Seçilen sakin artık bu dairede değil. Sayfayı yenileyin.');
    // Eski yönetici: sakin olur, dairesine bağlanır. daireyeGiris: aidat bu aydan itibaren beklenir
    // (yöneticiyken geçen aylar için "ödenmedi" görünmez).
    await Kullanici.updateOne(
      { _id: id, siteId },
      { rol: 'sakin', daireId: hedefDaireId, daireyeGiris: new Date() },
      { session }
    );
    // Dairenin kaydı: dolu işaretlenir, davet kodu artık kullanılamaz (başkası bu daireye katılamasın).
    // Boş daire seçildiyse filtrede davetKoduKullanildi "true değil" şartı var: tam bu sırada biri o dairenin kodla
    // katıldıysa güncelleme olmaz, 409 döner ve her şey geri alınır (bir dairede iki hesap olmaz).
    // $ne: true → "true olmayan": kurulumda oluşan dairelerde bu alan hiç yazılmamış olabilir (boş = kullanılmadı).
    const daireFiltresi = { _id: hedefDaireId, siteId, ...(ben.daireId ? {} : { davetKoduKullanildi: { $ne: true } }) };
    const daire = await Daire.updateOne(daireFiltresi, { davetKoduKullanildi: true, sakinId: id }, { session });
    if (daire.matchedCount === 0) throw new ApiHatasi(409, 'Seçtiğiniz daire az önce doldu. Başka bir daire seçin.');
  });

  // İki tarafın da uygulaması açıksa soketle haber verilir: telefon oturum bilgisini yeniden çeker ve
  // yeni rolün ekranlarına kendiliğinden geçer (tekrar giriş gerekmez).
  kullaniciyaGonder(yeniYonetici._id, 'rolDegisti', {});
  kullaniciyaGonder(id, 'rolDegisti', {});
  res.json({ yeniYonetici: yeniYonetici.ad });

  // Yeni yöneticiye push bildirim (uygulaması kapalıysa da haberi olsun). Cevaptan sonra gönderilir.
  if (yeniYonetici.pushToken) {
    pushGonder([yeniYonetici.pushToken], {
      baslik: 'Site yöneticiliği size devredildi',
      icerik: `${req.kullanici.ad} yöneticiliği size devretti. Uygulamayı açınca yönetici ekranlarını göreceksiniz.`,
    });
  }
});

module.exports = router;
