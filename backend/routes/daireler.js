// Daire route'ları: yöneticinin sitesindeki daireleri ve davet kodlarını görmesi, sakini daireden çıkarması.
const express = require('express');
const mongoose = require('mongoose');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Kullanici = require('../models/Kullanici');
const Mesaj = require('../models/Mesaj');
const SilinenHesap = require('../models/SilinenHesap');
const { girisGerekli, sadeceYonetici, DAIREDEN_CIKARILDI } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { davetKodlariUret } = require('../services/davetKodu');
const { kullaniciyiKopar } = require('../soket');

const router = express.Router();

// Davet kodları gizli bilgidir: sadece giriş yapmış YÖNETİCİ görebilir.
// router.use: bu dosyadaki tüm route'lardan önce çalışır. Sıra önemli: önce girisGerekli
// token'ı doğrulayıp req.kullanici'yi doldurur, sonra sadeceYonetici bu bilgiden rolü kontrol eder.
router.use(girisGerekli, sadeceYonetici);

// GET /api/daireler
// Kim kullanabilir: yönetici. Kendi sitesindeki binaları, her binanın içinde daireleriyle
// (numara, davet kodu, dolu mu, sakinin adı) sıralı olarak döner. siteId token'dan alınır; başka sitenin
// dairesi bu sorguya hiçbir şekilde giremez.
router.get('/', async (req, res) => {
  const { siteId } = req.kullanici;

  // Sorgular aynı anda çalışır (Promise.all), sonuçlar sıralı gelir: binalar A→Z, daireler 1→n.
  // Sakinler de alınır: daireye dokununca yönetici dairede kimin oturduğunu görsün (çıkarmadan önce).
  const [binalar, daireler, sakinler] = await Promise.all([
    Bina.find({ siteId }).sort({ ad: 1 }).lean(),
    Daire.find({ siteId }).sort({ daireNo: 1 }).select('binaId daireNo davetKodu davetKoduKullanildi').lean(),
    // Daireye bağlı tüm hesaplar: sakinler ve (devirle yönetici olduysa) dairesinde oturan yönetici.
    Kullanici.find({ siteId, daireId: { $ne: null } }).select('ad rol daireId').lean(),
  ]);
  // daireId → o dairedeki kişi (Map: her daire için ayrı sorgu atmadan hızlıca bulmak için).
  const kisi = new Map(sakinler.map((k) => [String(k.daireId), k]));

  // Daireler kendi binasının altına yerleştirilir; mobil ekran bina bina listeler.
  // binaId bir ObjectId (nesne) olduğu için === ile değil .equals() ile karşılaştırılır.
  // Async hata olursa Express 5 onu kendiliğinden merkezi hata yakalayıcıya iletir.
  const sonuc = binalar.map((bina) => ({
    id: bina._id,
    ad: bina.ad,
    daireler: daireler
      .filter((d) => d.binaId.equals(bina._id))
      .map((d) => ({
        id: d._id,
        daireNo: d.daireNo,
        davetKodu: d.davetKodu,
        dolu: d.davetKoduKullanildi, // kod kullanıldıysa dairede kayıtlı bir sakin var
        sakinAdi: kisi.get(String(d._id))?.ad ?? null,
        // yoneticiDairesi: dairede sitenin yöneticisi oturuyor; ekranda "Sakini çıkar" butonu gösterilmez.
        yoneticiDairesi: kisi.get(String(d._id))?.rol === 'yonetici',
      })),
  }));

  res.json(sonuc);
});

// POST /api/daireler/:id/sakini-cikar
// Kim kullanabilir: yönetici. Daire el değiştirdiğinde eski sakini daireden çıkarır ve daireye YENİ davet kodu verir:
// - Sakinin hesabı ve mesajları tamamen silinir (kişisel veri kalmaz). Geriye sadece e-postanın geri çevrilemez
//   özetinden oluşan, 30 gün sonra kendiliğinden silinen bir iz kalır (SilinenHesap): kişi giriş yapmaya
//   çalışınca "Daireden çıkarıldığınız için hesabınız silinmiştir" mesajını görür. Aynı e-postayla yeni hesap açabilir.
// - Telefonu açıksa soket ile haber verilir ve bağlantısı kapatılır; uygulama oturumu hemen kapatır.
// - Eski davet kodu geçersiz olur; yeni sakin yeni kodla katılır.
// - Dairenin aidat geçmişi SİLİNMEZ (site için gerekli kayıt); yönetici takvimde görmeye devam eder.
// Daire sorgusunda siteId olduğu için başka sitenin dairesi bulunamaz (404).
router.post('/:id/sakini-cikar', async (req, res) => {
  const { siteId } = req.kullanici;
  const daire = await Daire.findOne({ _id: req.params.id, siteId }).lean();
  if (!daire) throw new ApiHatasi(404, 'Daire bulunamadı.');
  if (!daire.davetKoduKullanildi) throw new ApiHatasi(400, 'Bu dairede kayıtlı bir sakin yok.');
  // Dairede yönetici oturuyorsa çıkarılamaz (yönetici önce yöneticiliği devretmeli); dairenin kaydı bozulmasın.
  if (await Kullanici.exists({ siteId, rol: 'yonetici', daireId: daire._id })) {
    throw new ApiHatasi(400, 'Bu daire site yöneticisine ait; yönetici daireden çıkarılamaz.');
  }

  // Dairedeki sakin (siteId ve daireId ile). Hesabını kendisi silmiş olabilir; o zaman sadece daire sıfırlanır.
  const sakin = await Kullanici.findOne({ siteId, rol: 'sakin', daireId: daire._id }).select('eposta').lean();

  // Hepsi tek transaction'da (ya hepsi ya hiçbiri): sakinin mesajları ve hesabı silinir, iz bırakılır,
  // daireye yeni kod verilip boş işaretlenir. Kod başka bir dairenin koduyla çakışırsa (çok düşük ihtimal)
  // unique index 11000 hatası verir, transaction geri alınır ve yeni kodla en fazla 3 kez denenir.
  let yeniKod;
  for (let deneme = 1; ; deneme++) {
    try {
      [yeniKod] = davetKodlariUret(1);
      await mongoose.connection.transaction(async (session) => {
        if (sakin) {
          // Sakinin gönderdiği ve aldığı tüm mesajlar, sonra hesabın kendisi silinir (ikisinde de siteId filtresi var).
          await Mesaj.deleteMany({ siteId, $or: [{ gonderenId: sakin._id }, { aliciId: sakin._id }] }, { session });
          await Kullanici.deleteOne({ _id: sakin._id, siteId }, { session });
          // İz bırakılır: e-postanın kendisi değil özeti saklanır (kişisel bilgi kalmaz).
          // upsert: bu e-postanın izi zaten varsa (daha önce de çıkarılmış) güncellenir, yoksa oluşturulur.
          // tarih yenilendiği için 30 günlük süre de baştan başlar.
          await SilinenHesap.updateOne(
            { epostaOzeti: SilinenHesap.ozet(sakin.eposta) },
            { kullaniciId: sakin._id, tarih: new Date() },
            { upsert: true, session }
          );
        }
        await Daire.updateOne(
          { _id: daire._id, siteId },
          { davetKodu: yeniKod, davetKoduKullanildi: false, sakinId: null },
          { session }
        );
      });
      break;
    } catch (hata) {
      if (hata.code === 11000 && deneme < 3) continue;
      throw hata;
    }
  }

  // Soket haberi veritabanı güncellendikten SONRA gönderilir: telefon tekrar bağlanmayı/istek atmayı
  // denerse girisGerekli artık onu reddeder. Yeni kod cevapla döner, yöneticinin ekranında hemen görünür.
  if (sakin) kullaniciyiKopar(sakin._id, 'dairedenCikarildi', { mesaj: DAIREDEN_CIKARILDI });
  res.json({ davetKodu: yeniKod });
});

module.exports = router;
