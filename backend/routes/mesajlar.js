// Mesaj route'ları: yönetici ile sakin arasındaki birebir yazışma.
// Sakin sadece kendi sitesinin yöneticisiyle, yönetici sadece kendi sitesinin sakinleriyle yazışabilir.
const express = require('express');
const { z } = require('zod');
const Mesaj = require('../models/Mesaj');
const Kullanici = require('../models/Kullanici');
const dogrula = require('../middleware/dogrula');
const { girisGerekli } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');
const { kullaniciyaGonder } = require('../soket');
const { pushGonder } = require('../services/bildirim');
const { daireAdlari } = require('../services/daire');

const router = express.Router();

// Tüm mesaj route'ları giriş gerektirir. siteId ve kullanıcı kimliği her zaman req.kullanici'dan (token) alınır.
router.use(girisGerekli);

// Konuşulmak istenen kişiyi bulur ve bu kişiyle yazışma izni olup olmadığını kontrol eder:
// - yönetici → sadece kendi sitesindeki, bir daireye bağlı sakinler
// - sakin → sadece kendi sitesinin yöneticisi
// Kişi yoksa, başka sitedeyse veya izin yoksa 404 döner (kişinin var olduğu belli edilmez).
// Geçersiz biçimdeki id CastError verir, merkezi hata yakalayıcı onu da 404'e çevirir.
async function karsiTarafiBul(ben, kisiId) {
  const izinliRol = ben.rol === 'yonetici' ? { rol: 'sakin', daireId: { $ne: null } } : { rol: 'yonetici' };
  // pushToken da alınır: mesaj gönderilince karşı tarafa bildirim göndermek için gerekir.
  const kisi = await Kullanici.findOne({ _id: kisiId, siteId: ben.siteId, ...izinliRol }).select('ad pushToken').lean();
  if (!kisi) throw new ApiHatasi(404, 'Kişi bulunamadı.');
  return kisi;
}

// Mesajı ekrana gönderilecek biçime çevirir. benden: mesajı isteği atan kişi mi yazdı
// (ekranda kendi mesajları sağda, karşı tarafınkiler solda gösterilir).
// gonderenId bir ObjectId (nesne) olduğu için === yerine .equals() ile karşılaştırılır.
// okundu: alıcı mesajı gördü mü; kendi mesajlarımda ✓ (iletildi) yerine ✓✓ (görüldü) göstermek için.
const mesajBicimi = (m, benimId) => ({
  id: m._id,
  icerik: m.icerik,
  tarih: m.tarih,
  benden: m.gonderenId.equals(benimId),
  okundu: m.okundu,
});

// GET /api/mesajlar/sohbetler
// Kim kullanabilir: giriş yapmış herkes. Yazışılabilecek kişileri, her biriyle son mesajı ile döner.
// Yönetici: sitedeki tüm sakinler (daire adıyla). Sakin: sadece sitenin yöneticisi.
// Sıralama: son mesajı en yeni olan üstte; hiç yazışılmamış kişiler altta, daire adına göre.
// okunmamis: o kişiden gelen ve henüz okumadığım mesaj sayısı (listede rozet olarak gösterilir).
router.get('/sohbetler', async (req, res) => {
  const { id, siteId, rol } = req.kullanici;
  let kisiler;
  if (rol === 'yonetici') {
    // Sakinler ve daire adları aynı anda (Promise.all) çekilir; hepsi siteId ile filtrelenir.
    // daireAdlari: daireId → "A5" eşlemesi (Map); her sakin için daire adını tek tek sorgu atmadan bulmayı sağlar.
    const [sakinler, daireAdi] = await Promise.all([
      Kullanici.find({ siteId, rol: 'sakin', daireId: { $ne: null } }).select('ad daireId').lean(),
      daireAdlari(siteId),
    ]);
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
  //    okunmamis: grubun içinde alıcısı ben olan ve okundu=false olan her mesaj için 1 eklenir ($sum).
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
        okunmamis: {
          $sum: { $cond: [{ $and: [{ $eq: ['$aliciId', id] }, { $eq: ['$okundu', false] }] }, 1, 0] },
        },
      },
    },
  ]);
  const sonMesaj = new Map(sonMesajlar.map((m) => [String(m._id), m]));

  const sohbetler = kisiler.map((k) => {
    const m = sonMesaj.get(String(k.id));
    return {
      ...k,
      sonMesaj: m ? { icerik: m.icerik, tarih: m.tarih, benden: m.gonderenId.equals(id) } : null,
      okunmamis: m?.okunmamis ?? 0,
    };
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

// PUT /api/mesajlar/:kisiId/okundu
// Kim kullanabilir: giriş yapmış herkes, sadece yazışma izni olduğu kişi için. Sohbet ekranı açıkken
// telefon bunu çağırır: o kişiden BANA gelmiş ve okunmamış mesajlar "okundu" işaretlenir (görüldü ✓✓).
// Sadece alıcısı ben olan mesajlar değişir; kimse karşı tarafın okuma durumunu değiştiremez.
router.put('/:kisiId/okundu', async (req, res) => {
  const { id, siteId } = req.kullanici;
  const kisi = await karsiTarafiBul(req.kullanici, req.params.kisiId);

  // zaman: işaretlemenin yapıldığı an. Bu andan SONRA gönderilen mesajlar okunmuş sayılmaz.
  const zaman = new Date();
  const sonuc = await Mesaj.updateMany(
    { siteId, gonderenId: kisi._id, aliciId: id, okundu: false, tarih: { $lte: zaman } },
    { okundu: true }
  );

  // Gerçekten yeni okunan mesaj varsa, mesajı GÖNDEREN kişiye soketle haber verilir; onun ekranında
  // bu sohbetteki mesajların ✓ işareti anında ✓✓ olur. kisiId: hangi sohbet olduğu (onun açısından ben).
  // zaman da gönderilir: telefon sadece bu andan önce gönderilmiş mesajları ✓✓ yapar; tam o sırada
  // gönderilmiş yeni bir mesaj yanlışlıkla "görüldü" görünmez.
  if (sonuc.modifiedCount > 0) {
    kullaniciyaGonder(kisi._id, 'mesajlarOkundu', { kisiId: String(id), zaman });
  }
  res.status(204).end();
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

  // Push bildirim cevaptan SONRA gönderilir: gönderen bildirimin gitmesini beklemez.
  // Alıcının uygulaması kapalı veya arka plandaysa telefonuna "Gönderen adı: mesaj" bildirimi düşer.
  // veri.kisiId: telefon, bu kişiyle sohbet zaten ekranda açıksa bildirimi göstermez (mesaj zaten ekrana düşüyor).
  // Uzun mesajın sadece ilk 100 karakteri gösterilir. pushGonder hata fırlatmaz, sadece loglar.
  if (kisi.pushToken) {
    const kisa = mesaj.icerik.length > 100 ? `${mesaj.icerik.slice(0, 100)}…` : mesaj.icerik;
    pushGonder([kisi.pushToken], {
      baslik: req.kullanici.ad,
      icerik: kisa,
      veri: { ekran: 'Sohbet', kisiId: String(id) },
    });
  }
});

module.exports = router;
