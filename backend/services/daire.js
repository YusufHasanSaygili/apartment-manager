// Daire yardımcıları: birden fazla route'un aynı şekilde yaptığı daire işleri tek yerde durur.
// - daireAdlari: dairelerin ekranda görünen adlarını ("B12") hesaplar.
// - sakiniKaldir: bir sakinin hesabını ve mesajlarını siler, dairesini boşaltıp yeni davet kodu verir
//   (yönetici sakini daireden çıkarınca ve sakin kendi hesabını silince kullanılır).
const mongoose = require('mongoose');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Kullanici = require('../models/Kullanici');
const Mesaj = require('../models/Mesaj');
const SilinenHesap = require('../models/SilinenHesap');
const { davetKodlariUret } = require('./davetKodu');

// Bir sitenin tüm dairelerinin adını döner: daireId (metin) → "B12" eşlemesi (Map).
// Daire adı bina adı + daire numarasıdır; bina ve daireler iki toplu sorguyla (her daire için ayrı sorgu
// atmadan) alınır. Promise.all: iki sorgu aynı anda çalışır. Sorguların ikisi de siteId ile filtrelenir.
async function daireAdlari(siteId) {
  const [binalar, daireler] = await Promise.all([
    Bina.find({ siteId }).select('ad').lean(),
    Daire.find({ siteId }).select('binaId daireNo').lean(),
  ]);
  const binaAdi = new Map(binalar.map((b) => [String(b._id), b.ad]));
  return new Map(daireler.map((d) => [String(d._id), `${binaAdi.get(String(d.binaId))}${d.daireNo}`]));
}

// Bir sakini sistemden kaldırır ve dairesini yeni sakine hazırlar. Hepsi tek transaction'da yapılır
// (ya hepsi ya hiçbiri):
// - sakin verilmişse: gönderdiği ve aldığı tüm mesajlar, sonra hesabın kendisi silinir (ad, e-posta, şifre hash'i,
//   push token birlikte gider). Kayıt kalmadığı için bu hesabın token'ı artık hiçbir istekte geçmez (401).
// - iz true ise (sakin daireden ÇIKARILDIYSA): kişi giriş yapmaya çalışınca nedenini görebilsin diye e-postanın
//   özeti SilinenHesap'a yazılır. upsert: iz zaten varsa güncellenir, yoksa oluşturulur; tarih yenilendiği için
//   30 günlük süre baştan başlar. Kendi hesabını silen sakin için iz bırakılmaz.
// - daireFiltresi verilmişse: daire boşaltılır (sakin bağı kaldırılır) ve eski kod yerine kullanılmamış yeni bir
//   davet kodu konur. Filtrede her zaman siteId vardır (site izolasyonu).
// Yeni kod başka bir dairenin koduyla çakışırsa (çok düşük ihtimal) unique index 11000 hatası verir, transaction
// geri alınır ve yeni kodla en fazla 3 kez denenir. Dönen değer: dairenin yeni davet kodu.
async function sakiniKaldir({ siteId, sakin, iz = false, daireFiltresi }) {
  for (let deneme = 1; ; deneme++) {
    const [yeniKod] = davetKodlariUret(1);
    try {
      await mongoose.connection.transaction(async (session) => {
        if (sakin) {
          await Mesaj.deleteMany({ siteId, $or: [{ gonderenId: sakin._id }, { aliciId: sakin._id }] }, { session });
          await Kullanici.deleteOne({ _id: sakin._id, siteId }, { session });
          if (iz) {
            await SilinenHesap.updateOne(
              { epostaOzeti: SilinenHesap.ozet(sakin.eposta) },
              { kullaniciId: sakin._id, tarih: new Date() },
              { upsert: true, session }
            );
          }
        }
        if (daireFiltresi) {
          await Daire.updateOne(
            { ...daireFiltresi, siteId },
            { davetKodu: yeniKod, davetKoduKullanildi: false, sakinId: null },
            { session }
          );
        }
      });
      return yeniKod;
    } catch (hata) {
      if (hata.code === 11000 && deneme < 3) continue;
      throw hata;
    }
  }
}

module.exports = { daireAdlari, sakiniKaldir };
