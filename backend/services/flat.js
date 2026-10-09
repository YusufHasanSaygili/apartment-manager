// Daire yardımcıları: birden fazla route'un aynı şekilde yaptığı daire işleri tek yerde durur.
// - flatNames: dairelerin ekranda görünen adlarını ("B12") hesaplar.
// - detachResident: bir sakinin hesabını ve mesajlarını siler, dairesini boşaltıp yeni davet kodu verir
//   (yönetici sakini daireden çıkarınca ve sakin kendi hesabını silince kullanılır).
const mongoose = require('mongoose');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const User = require('../models/User');
const Message = require('../models/Message');
const DeletedAccount = require('../models/DeletedAccount');
const { generateInviteCodes } = require('./inviteCode');

// Bir sitenin tüm dairelerinin adını döner: daireId (metin) → "B12" eşlemesi (Map).
// Daire adı bina adı + daire numarasıdır; bina ve daireler iki toplu sorguyla (her daire için ayrı sorgu
// atmadan) alınır. Promise.all: iki sorgu aynı anda çalışır. Sorguların ikisi de siteId ile filtrelenir.
async function flatNames(siteId) {
  const [buildings, flats] = await Promise.all([
    Building.find({ siteId }).select('ad').lean(),
    Flat.find({ siteId }).select('binaId daireNo').lean(),
  ]);
  const buildingName = new Map(buildings.map((b) => [String(b._id), b.ad]));
  return new Map(flats.map((d) => [String(d._id), `${buildingName.get(String(d.binaId))}${d.daireNo}`]));
}

// Bir sakini sistemden kaldırır ve dairesini yeni sakine hazırlar. Hepsi tek transaction'da yapılır
// (ya hepsi ya hiçbiri):
// - sakin verilmişse: gönderdiği ve aldığı tüm mesajlar, sonra hesabın kendisi silinir (ad, e-posta, şifre hash'i,
//   push token birlikte gider). Kayıt kalmadığı için bu hesabın token'ı artık hiçbir istekte geçmez (401).
// - leaveTrace true ise (sakin daireden ÇIKARILDIYSA): kişi giriş yapmaya çalışınca nedenini görebilsin diye e-postanın
//   özeti DeletedAccount'a yazılır. upsert: iz zaten varsa güncellenir, yoksa oluşturulur; tarih yenilendiği için
//   30 günlük süre baştan başlar. Kendi hesabını silen sakin için iz bırakılmaz.
// - flatFilter verilmişse: daire boşaltılır (sakin bağı kaldırılır) ve eski kod yerine kullanılmamış yeni bir
//   davet kodu konur. Filtrede her zaman siteId vardır (site izolasyonu).
// Yeni kod başka bir dairenin koduyla çakışırsa (çok düşük ihtimal) unique index 11000 hatası verir, transaction
// geri alınır ve yeni kodla en fazla 3 kez denenir. Dönen değer: dairenin yeni davet kodu.
async function detachResident({ siteId, sakin: resident, leaveTrace = false, flatFilter }) {
  for (let attempt = 1; ; attempt++) {
    const [newCode] = generateInviteCodes(1);
    try {
      await mongoose.connection.transaction(async (session) => {
        if (resident) {
          await Message.deleteMany({ siteId, $or: [{ gonderenId: resident._id }, { aliciId: resident._id }] }, { session });
          await User.deleteOne({ _id: resident._id, siteId }, { session });
          if (leaveTrace) {
            await DeletedAccount.updateOne(
              { epostaOzeti: DeletedAccount.ozet(resident.eposta) },
              { kullaniciId: resident._id, tarih: new Date() },
              { upsert: true, session }
            );
          }
        }
        if (flatFilter) {
          await Flat.updateOne(
            { ...flatFilter, siteId },
            { davetKodu: newCode, davetKoduKullanildi: false, sakinId: null },
            { session }
          );
        }
      });
      return newCode;
    } catch (error) {
      if (error.code === 11000 && attempt < 3) continue;
      throw error;
    }
  }
}

module.exports = { flatNames, detachResident };
