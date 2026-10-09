// Yönetici devri route'ları: yönetici, sitedeki bir dairenin sakinini yeni yönetici yapar; kendisi sakin olur.
// Site sıfırdan kurulmaz: daireler, aidat geçmişi, duyurular ve sakin hesapları olduğu gibi kalır.
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Flat = require('../models/Flat');
const User = require('../models/User');
const Site = require('../models/Site');
const validate = require('../middleware/validate');
const { requireAuth, managerOnly } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { sendToUser } = require('../socket');
const { sendPush } = require('../services/pushNotifications');
// flatNames: flatId → "B12" eşlemesi (ortak yardımcı, services/flat.js).
const { flatNames } = require('../services/flat');

const router = express.Router();

// Devir sadece sitenin YÖNETİCİSİ tarafından yapılabilir. siteId ve yöneticinin kimliği token'dan alınır.
router.use(requireAuth, managerOnly);

// "A2" "A10"dan önce gelsin diye sayısal (numeric) sıralama.
const byName = (a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true });

// GET /api/devir/secenekler
// Kim kullanabilir: yönetici. Devir ekranının ihtiyaç duyduğu listeleri döner:
// - adaylar: sakini olan daireler (yeni yönetici bunlardan biri olur), örn. { daireId, ad: "B12", sakinAdi: "Ahmet" }
// - kendiDairem: yöneticinin kayıtlı dairesi (daha önce devirle yönetici olduysa); devirden sonra buraya sakin olur
// - bosDaireler: kendiDairem yoksa (siteyi kuran yönetici), devirden sonra oturacağı daireyi seçmesi için içinde kimse
//   kayıtlı olmayan daireler
router.get('/secenekler', async (req, res) => {
  const { id, siteId } = req.kullanici;
  const [names, registered, me] = await Promise.all([
    flatNames(siteId),
    // Bir daireye bağlı tüm hesaplar (sakinler ve dairesi olan yönetici): "boş daire" bulmak için.
    User.find({ siteId, daireId: { $ne: null } }).select('ad rol daireId').lean(),
    User.findById(id).select('daireId').lean(),
  ]);

  const candidates = registered
    .filter((k) => k.rol === 'sakin')
    .map((k) => ({ daireId: k.daireId, ad: names.get(String(k.daireId)) ?? '—', sakinAdi: k.ad }))
    .sort(byName);

  const myFlat = me.daireId ? { id: me.daireId, ad: names.get(String(me.daireId)) ?? '—' } : null;

  // Set: içinde kayıtlı biri olan dairelerin kimlikleri; geri kalanlar boştur.
  const occupiedFlats = new Set(registered.map((k) => String(k.daireId)));
  const emptyFlats = myFlat
    ? []
    : [...names].filter(([flatId]) => !occupiedFlats.has(flatId)).map(([flatId, name]) => ({ id: flatId, ad: name })).sort(byName);

  res.json({ adaylar: candidates, kendiDairem: myFlat, bosDaireler: emptyFlats });
});

// Devir formunun kuralları: daire kimlikleri MongoDB kimliği biçiminde (24 karakter onaltılık) olmalı.
// kendiDaireId sadece yöneticinin kayıtlı dairesi yoksa gerekir.
const objectIdRule = z.string().regex(/^[a-f\d]{24}$/i, 'Daire geçersiz');
const handoverSchema = z.object({
  yeniYoneticiDaireId: objectIdRule,
  kendiDaireId: objectIdRule.optional(),
});

// POST /api/devir
// Kim kullanabilir: sitenin yöneticisi. Seçilen dairenin sakinini yeni yönetici yapar, kendisi sakin olur.
// - Yeni yönetici: o dairenin sakini (siteId ile aranır; başka sitenin kişisi bulunamaz → 404).
// - Eski yönetici: kayıtlı dairesi varsa oraya, yoksa seçtiği BOŞ daireye sakin olarak bağlanır.
// Tüm değişiklikler tek transaction'da yapılır (ya hepsi olur ya hiçbiri); yarım kalmış devir olmaz.
router.post('/', validate(handoverSchema), async (req, res) => {
  const { id, siteId } = req.kullanici;
  const { yeniYoneticiDaireId: newManagerFlatId, kendiDaireId: ownFlatId } = req.body;

  const newManager = await User.findOne({ siteId, rol: 'sakin', daireId: newManagerFlatId })
    .select('ad pushToken')
    .lean();
  if (!newManager) throw new ApiError(404, 'Seçilen dairede kayıtlı bir sakin bulunamadı.');

  // Eski yöneticinin devirden sonra oturacağı daire.
  const me = await User.findById(id).select('daireId').lean();
  let targetFlatId = me.daireId;
  if (!targetFlatId) {
    if (!ownFlatId) throw new ApiError(400, 'Devirden sonra oturacağınız daireyi seçin.');
    const flat = await Flat.findOne({ _id: ownFlatId, siteId }).select('_id').lean();
    if (!flat) throw new ApiError(404, 'Daire bulunamadı.');
    // Seçilen dairede başka biri kayıtlıysa oraya bağlanılamaz (bir dairede tek hesap).
    if (await User.exists({ siteId, daireId: flat._id })) {
      throw new ApiError(400, 'Seçtiğiniz dairede kayıtlı biri var. Boş bir daire seçin.');
    }
    targetFlatId = flat._id;
  }

  // Transaction: dört güncelleme birlikte yapılır. İçeride hata fırlatılırsa hepsi geri alınır.
  await mongoose.connection.transaction(async (session) => {
    // Sitenin yöneticisi değişir. Filtrede yoneticiId: id var: aynı anda iki devir denenirse ikincisi
    // hiçbir şeyi değiştiremez (modifiedCount 0) ve 409 alır.
    const site = await Site.updateOne({ _id: siteId, yoneticiId: id }, { yoneticiId: newManager._id }, { session });
    if (site.modifiedCount === 0) throw new ApiError(409, 'Yöneticilik zaten devredilmiş.');

    // Yeni yönetici: rolü değişir, dairesi (daireId) kayıtlı kalır; ileride devrederse oraya döner.
    // Filtrede "hâlâ o dairenin sakini" şartı var: kişi bu arada daireden çıkarıldıysa hiçbir şey değişmez,
    // hata fırlatılır ve transaction tüm değişiklikleri geri alır.
    const managerUpdate = await User.updateOne(
      { _id: newManager._id, siteId, rol: 'sakin', daireId: newManagerFlatId },
      { rol: 'yonetici' },
      { session }
    );
    if (managerUpdate.modifiedCount === 0) throw new ApiError(409, 'Seçilen sakin artık bu dairede değil. Sayfayı yenileyin.');
    // Eski yönetici: sakin olur, dairesine bağlanır. daireyeGiris: aidat bu aydan itibaren beklenir
    // (yöneticiyken geçen aylar için "ödenmedi" görünmez).
    await User.updateOne(
      { _id: id, siteId },
      { rol: 'sakin', daireId: targetFlatId, daireyeGiris: new Date() },
      { session }
    );
    // Dairenin kaydı: dolu işaretlenir, davet kodu artık kullanılamaz (başkası bu daireye katılamasın).
    // Boş daire seçildiyse filtrede davetKoduKullanildi "true değil" şartı var: tam bu sırada biri o dairenin kodla
    // katıldıysa güncelleme olmaz, 409 döner ve her şey geri alınır (bir dairede iki hesap olmaz).
    // $ne: true → "true olmayan": kurulumda oluşan dairelerde bu alan hiç yazılmamış olabilir (boş = kullanılmadı).
    const flatFilter = { _id: targetFlatId, siteId, ...(me.daireId ? {} : { davetKoduKullanildi: { $ne: true } }) };
    const flat = await Flat.updateOne(flatFilter, { davetKoduKullanildi: true, sakinId: id }, { session });
    if (flat.matchedCount === 0) throw new ApiError(409, 'Seçtiğiniz daire az önce doldu. Başka bir daire seçin.');
  });

  // İki tarafın da uygulaması açıksa soketle haber verilir: telefon oturum bilgisini yeniden çeker ve
  // yeni rolün ekranlarına kendiliğinden geçer (tekrar giriş gerekmez).
  sendToUser(newManager._id, 'rolDegisti', {});
  sendToUser(id, 'rolDegisti', {});
  res.json({ yeniYonetici: newManager.ad });

  // Yeni yöneticiye push bildirim (uygulaması kapalıysa da haberi olsun). Cevaptan sonra gönderilir.
  if (newManager.pushToken) {
    sendPush([newManager.pushToken], {
      baslik: 'Site yöneticiliği size devredildi',
      icerik: `${req.kullanici.ad} yöneticiliği size devretti. Uygulamayı açınca yönetici ekranlarını göreceksiniz.`,
    });
  }
});

module.exports = router;
