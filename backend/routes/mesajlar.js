// Mesaj route'ları: yönetici ile sakin arasındaki birebir yazışma.
// Sakin sadece kendi sitesinin yöneticisiyle, yönetici sadece kendi sitesinin sakinleriyle yazışabilir.
const express = require('express');
const { z } = require('zod');
const Mesaj = require('../models/Mesaj');
const Kullanici = require('../models/Kullanici');
const Daire = require('../models/Daire');
const Bina = require('../models/Bina');
const dogrula = require('../middleware/dogrula');
const { girisGerekli } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { kullaniciyaGonder } = require('../soket');

const router = express.Router();

// Tüm mesaj route'ları giriş gerektirir. siteId ve kullanıcı kimliği her zaman req.kullanici'dan (token) alınır.
router.use(girisGerekli);

// Dairesinden çıkarılmış (daireId'si olmayan) sakin mesajlaşamaz; yönetici her zaman geçer.
// Rol kontrolü backend'de yapılır, ekranda butonu gizlemek tek başına yetmez.
function mesajlasabilirMi(ben) {
  if (ben.rol === 'sakin' && !ben.daireId) {
    throw new ApiHatasi(403, 'Mesajlaşmak için bir daireye bağlı olmalısınız.');
  }
}

// Konuşulmak istenen kişiyi bulur ve bu kişiyle yazışma izni olup olmadığını kontrol eder:
// - yönetici → sadece kendi sitesindeki, bir daireye bağlı sakinler
// - sakin → sadece kendi sitesinin yöneticisi
// Kişi yoksa, başka sitedeyse veya izin yoksa 404 döner (kişinin var olduğu belli edilmez).
// Geçersiz biçimdeki id CastError verir, merkezi hata yakalayıcı onu da 404'e çevirir.
async function karsiTarafiBul(ben, kisiId) {
  mesajlasabilirMi(ben);
  const izinliRol = ben.rol === 'yonetici' ? { rol: 'sakin', daireId: { $ne: null } } : { rol: 'yonetici' };
  const kisi = await Kullanici.findOne({ _id: kisiId, siteId: ben.siteId, ...izinliRol }).select('ad').lean();
  if (!kisi) throw new ApiHatasi(404, 'Kişi bulunamadı.');
  return kisi;
}

// Mesajı ekrana gönderilecek biçime çevirir. benden: mesajı isteği atan kişi mi yazdı
// (ekranda kendi mesajları sağda, karşı tarafınkiler solda gösterilir).
// gonderenId bir ObjectId (nesne) olduğu için === yerine .equals() ile karşılaştırılır.
const mesajBicimi = (m, benimId) => ({
  id: m._id,
  icerik: m.icerik,
  tarih: m.tarih,
  benden: m.gonderenId.equals(benimId),
});

// GET /api/mesajlar/sohbetler
// Kim kullanabilir: giriş yapmış herkes. Yazışılabilecek kişileri, her biriyle son mesajı ile döner.
// Yönetici: sitedeki tüm sakinler (daire adıyla). Sakin: sadece sitenin yöneticisi.
// Sıralama: son mesajı en yeni olan üstte; hiç yazışılmamış kişiler altta, daire adına göre.
router.get('/sohbetler', async (req, res) => {
  const { id, siteId, rol } = req.kullanici;
  // Daireden çıkarılmış sakin listeyi de göremez (403).
  mesajlasabilirMi(req.kullanici);

  let kisiler;
  if (rol === 'yonetici') {
    // Sakinler, daireler ve binalar aynı anda (Promise.all) çekilir; hepsi siteId ile filtrelenir.
    const [sakinler, daireler, binalar] = await Promise.all([
      Kullanici.find({ siteId, rol: 'sakin', daireId: { $ne: null } }).select('ad daireId').lean(),
      Daire.find({ siteId }).select('binaId daireNo').lean(),
      Bina.find({ siteId }).select('ad').lean(),
    ]);
    // Map: id → ad eşlemesi; her sakin için daire adını ("A5") tek tek sorgu atmadan bulmayı sağlar.
    const binaAdi = new Map(binalar.map((b) => [String(b._id), b.ad]));
    const daireAdi = new Map(daireler.map((d) => [String(d._id), `${binaAdi.get(String(d.binaId))}${d.daireNo}`]));
    kisiler = sakinler.map((s) => ({ id: s._id, ad: s.ad, altBaslik: daireAdi.get(String(s.daireId)) ?? '—' }));
  } else {
    const yonetici = await Kullanici.findOne({ siteId, rol: 'yonetici' }).select('ad').lean();
    kisiler = yonetici ? [{ id: yonetici._id, ad: yonetici.ad, altBaslik: 'Site yöneticisi' }] : [];
  }

  // Her sohbetin son mesajı tek bir veritabanı sorgusuyla (aggregate) bulunur:
  // 1) $match: bu sitede, benim gönderdiğim veya bana gelen mesajlar
  // 2) $sort: yeniden eskiye sıralanır
  // 3) $group: mesajlar karşı tarafa göre gruplanır ($cond: gönderen bensem karşı taraf alıcıdır,
  //    değilse gönderendir); $first sıralama yeniden eskiye olduğu için her grubun EN YENİ mesajını alır.
  // Not: aggregate, find gibi metin → ObjectId dönüşümünü kendisi yapmaz; id ve siteId token'dan
  // (veritabanı kaydından) ObjectId olarak geldiği için eşleşme doğru çalışır.
  const sonMesajlar = await Mesaj.aggregate([
    { $match: { siteId, $or: [{ gonderenId: id }, { aliciId: id }] } },
    { $sort: { tarih: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$gonderenId', id] }, '$aliciId', '$gonderenId'] },
        icerik: { $first: '$icerik' },
        tarih: { $first: '$tarih' },
        gonderenId: { $first: '$gonderenId' },
      },
    },
  ]);
  const sonMesaj = new Map(sonMesajlar.map((m) => [String(m._id), m]));

  const sohbetler = kisiler.map((k) => {
    const m = sonMesaj.get(String(k.id));
    return { ...k, sonMesaj: m ? { icerik: m.icerik, tarih: m.tarih, benden: m.gonderenId.equals(id) } : null };
  });
  // Son mesajı olanlar yeniden eskiye; olmayanlar daire adına göre ("A2" "A10"dan önce gelsin diye numeric).
  sohbetler.sort((a, b) => {
    if (a.sonMesaj && b.sonMesaj) return b.sonMesaj.tarih - a.sonMesaj.tarih;
    if (a.sonMesaj || b.sonMesaj) return a.sonMesaj ? -1 : 1;
    return a.altBaslik.localeCompare(b.altBaslik, 'tr', { numeric: true });
  });

  res.json(sohbetler);
});

// GET /api/mesajlar/:kisiId
// Kim kullanabilir: giriş yapmış herkes, ama sadece yazışma izni olduğu kişiyle (bkz. karsiTarafiBul).
// İki kişi arasındaki son 100 mesajı YENİDEN ESKİYE döner (mobildeki ters çevrilmiş liste en yeniyi altta gösterir).
router.get('/:kisiId', async (req, res) => {
  const { id, siteId } = req.kullanici;
  const kisi = await karsiTarafiBul(req.kullanici, req.params.kisiId);

  // Sadece bu iki kişi arasındaki mesajlar: ben → o veya o → ben (siteId filtresiyle birlikte).
  const mesajlar = await Mesaj.find({
    siteId,
    $or: [
      { gonderenId: id, aliciId: kisi._id },
      { gonderenId: kisi._id, aliciId: id },
    ],
  })
    .sort({ tarih: -1 })
    .limit(100)
    .lean();

  res.json(mesajlar.map((m) => mesajBicimi(m, id)));
});

// Mesaj gönderme formunun kuralları: alıcı geçerli bir kimlik olmalı, mesaj boş veya 1000 karakterden uzun olamaz.
const mesajSemasi = z.object({
  aliciId: z.string({ error: 'Alıcı seçilmeli' }).regex(/^[a-f\d]{24}$/i, 'Alıcı geçersiz'),
  icerik: z.string({ error: 'Mesaj yazılmalı' }).trim().min(1, 'Mesaj boş olamaz').max(1000, 'Mesaj en fazla 1000 karakter olabilir'),
});

// POST /api/mesajlar
// Kim kullanabilir: giriş yapmış herkes, ama sadece yazışma izni olduğu kişiye (sakin → yönetici, yönetici → sakin).
// Gönderen ve site istekten değil token'dan alınır; kimse başkası adına veya başka siteye mesaj atamaz.
router.post('/', dogrula(mesajSemasi), async (req, res) => {
  const { id, siteId } = req.kullanici;
  // Alıcı izinli biri değilse (başka site, başka sakin vb.) burada 404 fırlatılır ve mesaj kaydedilmez.
  const kisi = await karsiTarafiBul(req.kullanici, req.body.aliciId);

  const mesaj = await Mesaj.create({ siteId, gonderenId: id, aliciId: kisi._id, icerik: req.body.icerik });

  // Mesaj, Socket.io ile hem alıcının hem gönderenin (diğer cihazlarının) telefonuna anında iletilir.
  // Her biri için "benden" alanı kendi açısından hesaplanır; kisiId de mesajın hangi sohbete ait
  // olduğunu (karşı tarafın kimliğini) söyler. Telefon sadece o sohbet açıksa mesajı ekrana ekler.
  kullaniciyaGonder(kisi._id, 'yeniMesaj', { ...mesajBicimi(mesaj, kisi._id), kisiId: String(id) });
  kullaniciyaGonder(id, 'yeniMesaj', { ...mesajBicimi(mesaj, id), kisiId: String(kisi._id) });

  res.status(201).json(mesajBicimi(mesaj, id));
});

module.exports = router;
