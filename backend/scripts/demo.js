// Demo verisi betiği: sunum için dolu bir örnek site ("Lale Sitesi") kurar.
// Çalıştırma: backend klasöründe `npm run demo`. Sunucunun açık olması gerekmez; veritabanına doğrudan bağlanır.
// (npm betiği `node --env-file=.env` ile çalışır; MONGODB_URI gibi ayarlar .env'den gelir.)
// Her çalıştığında önce eski demo sitesini (ve sadece onu) siler, sonra baştan kurar; diğer sitelere dokunmaz.
// Tarihler bugüne göre hesaplanır: betik hangi gün çalışırsa çalışsın harita "bu ay" için üç renkli görünür.
const dns = require('node:dns');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Site = require('../models/Site');
const Kullanici = require('../models/Kullanici');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Aidat = require('../models/Aidat');
const Duyuru = require('../models/Duyuru');
const Mesaj = require('../models/Mesaj');
const TekrarlananDuyuru = require('../models/TekrarlananDuyuru');
const { davetKodlariUret } = require('../services/davetKodu');

// server.js'teki gibi: .env'de DNS_SUNUCULARI varsa Atlas adresi bu DNS sunucularıyla çözülür
// (bazı bilgisayarlarda yerel DNS "mongodb+srv" kaydını çözemiyor: querySrv ECONNREFUSED).
if (process.env.DNS_SUNUCULARI) {
  dns.setServers(process.env.DNS_SUNUCULARI.split(',').map((s) => s.trim()));
}

// Demo hesaplarının ortak şifresi ve demo sitesini tanımak için kullanılan yönetici e-postası.
// Sadece demo içindir; README'de de yazılıdır.
const SIFRE = 'Demo1234';
const YONETICI_EPOSTA = 'lale.yonetici@ornek.com';
const AIDAT = 1500;
const DAIRE_SAYISI = 8; // her binada (A1–A8, B1–B8)

// Sakinler: hangi dairede oturdukları ve aidat geçmişleri.
// eksikAylar: ödenmemiş geçmiş aylar (kaç ay önce); katilma: daireye kaç ay önce geldi (verilmezse 9);
// elleAy: yöneticinin elle "ödendi" işaretlediği ay (kaç ay önce);
// buAy: bu ayın aidatının durumu (null = hiç bildirim yok → haritada kırmızı).
const SAKINLER = [
  { daire: 'A1', ad: 'Mehmet Demir', buAy: { durum: 'onaylandi', yontem: 'banka', aciklama: 'Ziraat Bankası havale' } },
  { daire: 'A2', ad: 'Fatma Şahin', elleAy: 2, buAy: { durum: 'onaylandi', yontem: 'elden', aciklama: '' } },
  { daire: 'A3', ad: 'Elif Arslan', buAy: { durum: 'bekliyor', yontem: 'banka', aciklama: "Garanti'den havale yaptım" } },
  { daire: 'A5', ad: 'Can Yıldız', buAy: { durum: 'bekliyor', yontem: 'elden', aciklama: 'Kapıcıya bıraktım' } },
  { daire: 'A6', ad: 'Selin Aydın', eksikAylar: [3], buAy: { durum: 'reddedildi', yontem: 'banka', aciklama: 'Havale yaptım' } },
  { daire: 'A8', ad: 'Burak Öztürk', buAy: { durum: 'onaylandi', yontem: 'banka', aciklama: '' } },
  { daire: 'B1', ad: 'Ayşe Koç', buAy: { durum: 'bekliyor', yontem: 'banka', aciklama: 'İş Bankası, açıklamaya B1 yazdım' } },
  { daire: 'B2', ad: 'Emre Çelik', buAy: { durum: 'onaylandi', yontem: 'elden', aciklama: '' } },
  { daire: 'B4', ad: 'Deniz Kurt', eksikAylar: [1, 2], buAy: null },
  { daire: 'B7', ad: 'Gizem Aksoy', katilma: 3, buAy: { durum: 'bekliyor', yontem: 'banka', aciklama: 'Bu ayın aidatı' } },
];

// Yardımcılar: bugünden "n ay önce"nin ay/yıl bilgisi ve "n gün / saat önce"nin tarihi.
const simdi = new Date();
const ayOnce = (n) => {
  const t = new Date(simdi.getFullYear(), simdi.getMonth() - n, 1);
  return { ay: t.getMonth() + 1, yil: t.getFullYear(), tarih: t };
};
// gun 0 iken saat, gece yarısından bu yana geçen saati aşmaz: "bugün"ün kayıtları düne kaymasın ("Bugün" etiketi doğru çıksın).
const gunOnce = (gun, saat = 0) =>
  new Date(simdi.getTime() - (gun * 24 + (gun === 0 ? Math.min(saat, simdi.getHours()) : saat)) * 60 * 60 * 1000);

// Sakinin demo e-postası: "A3" → lale.a3@ornek.com
const sakinEpostasi = (daire) => `lale.${daire.toLowerCase()}@ornek.com`;

// Eski demo sitesini ve ona bağlı her şeyi siler. Demo sitesi, demo hesaplarından herhangi birinin (yönetici veya
// sakin) sitesi olarak bulunur: sunumda yöneticilik devredilip yöneticinin hesabı silinse bile site yine bulunur.
// Her sorgu bu siteId'lerle filtrelenir; demo hesabı olmayan başka bir sitenin verisi silinmez.
async function eskiDemoyuSil() {
  const epostalar = [YONETICI_EPOSTA, ...SAKINLER.map((s) => sakinEpostasi(s.daire))];
  const siteIdler = await Kullanici.distinct('siteId', { eposta: { $in: epostalar } });
  if (siteIdler.length === 0) return;
  const filtre = { siteId: { $in: siteIdler } };
  await Promise.all([Kullanici, Bina, Daire, Aidat, Duyuru, Mesaj, TekrarlananDuyuru].map((Model) => Model.deleteMany(filtre)));
  await Site.deleteMany({ _id: { $in: siteIdler } });
  console.log('Eski demo sitesi silindi.');
}

async function demoKur() {
  // Şifre bir kez hash'lenir ve tüm demo hesaplarında kullanılır. Kullanıcılar aşağıda Kullanici.collection.insertOne ile
  // (Mongoose'u atlayıp doğrudan veritabanı sürücüsüyle) eklenir; böylece createdAt geçmiş bir tarih olabilir. Bu yol
  // modeldeki pre('save') kancasını (kayıttan önce şifreyi hash'leyen fonksiyon) çalıştırmaz, bu yüzden şifre burada
  // elle hash'lenir (düz metin asla saklanmaz). Şema doğrulaması ve varsayılan değerler de çalışmaz; tüm alanlar elle yazılır.
  const sifre = await bcrypt.hash(SIFRE, 12);

  // Site ve yöneticisi birbirini gösterdiği için id'ler önceden üretilir. Önce yönetici eklenir: betik arada
  // yarıda kalsa bile site, yöneticinin e-postasıyla bulunup bir sonraki çalıştırmada silinebilir.
  const siteId = new mongoose.Types.ObjectId();
  const yoneticiId = new mongoose.Types.ObjectId();
  await Kullanici.collection.insertOne({
    _id: yoneticiId,
    siteId,
    ad: 'Zeynep Kaya',
    eposta: YONETICI_EPOSTA,
    sifre,
    rol: 'yonetici',
    daireId: null,
    daireyeGiris: null,
    pushToken: null,
    sifirlamaDeneme: 0,
    createdAt: ayOnce(10).tarih,
    updatedAt: ayOnce(10).tarih,
  });
  await Site.create({ _id: siteId, ad: 'Lale Sitesi', yoneticiId, aidatTutari: AIDAT });

  // Binalar (A, B) ve daireler; her daireye benzersiz davet kodu
  const binalar = await Bina.insertMany([{ siteId, ad: 'A' }, { siteId, ad: 'B' }]);
  const kodlar = davetKodlariUret(binalar.length * DAIRE_SAYISI);
  const daireler = await Daire.insertMany(
    binalar.flatMap((bina, b) =>
      Array.from({ length: DAIRE_SAYISI }, (_, i) => ({
        siteId,
        binaId: bina._id,
        daireNo: i + 1,
        davetKodu: kodlar[b * DAIRE_SAYISI + i],
      })),
    ),
  );
  // "A3" → daire kaydı (sakinleri yerleştirmek için)
  const daireBul = (ad) => daireler.find((d) => binalar.find((b) => b._id.equals(d.binaId)).ad + d.daireNo === ad);

  // Sakin hesapları: her biri kendi dairesine bağlanır, dairenin davet kodu kullanılmış olur
  const aidatlar = [];
  const sakinler = {};
  for (const s of SAKINLER) {
    const daire = daireBul(s.daire);
    const katilma = s.katilma ?? 9;
    const kullaniciId = new mongoose.Types.ObjectId();
    sakinler[s.daire] = kullaniciId;
    await Kullanici.collection.insertOne({
      _id: kullaniciId,
      siteId,
      ad: s.ad,
      eposta: sakinEpostasi(s.daire),
      sifre,
      rol: 'sakin',
      daireId: daire._id,
      daireyeGiris: ayOnce(katilma).tarih,
      pushToken: null,
      sifirlamaDeneme: 0,
      createdAt: ayOnce(katilma).tarih,
      updatedAt: ayOnce(katilma).tarih,
    });
    await Daire.updateOne({ _id: daire._id, siteId }, { davetKoduKullanildi: true, sakinId: kullaniciId });

    // Geçmiş aylar: katıldığı aydan geçen aya kadar, eksik aylar hariç hepsi onaylanmış.
    // elleAy: o ay yöneticinin elle "ödendi" işaretlediği ay (odemeYontemi 'yonetici').
    for (let n = katilma; n >= 1; n--) {
      if (s.eksikAylar?.includes(n)) continue;
      const { ay, yil, tarih } = ayOnce(n);
      const elle = s.elleAy === n;
      aidatlar.push({
        siteId,
        daireId: daire._id,
        ay,
        yil,
        tutar: AIDAT,
        odemeYontemi: elle ? 'yonetici' : n % 2 ? 'banka' : 'elden',
        aciklama: '',
        durum: 'onaylandi',
        tarih: new Date(tarih.getTime() + 3 * 24 * 60 * 60 * 1000),
      });
    }
    // Bu ay: reddedilen bildirimden sonra sakin henüz yenisini göndermemiş olabilir (A6 → haritada kırmızı)
    if (s.buAy) {
      const { ay, yil } = ayOnce(0);
      aidatlar.push({
        siteId,
        daireId: daire._id,
        ay,
        yil,
        tutar: AIDAT,
        odemeYontemi: s.buAy.yontem,
        aciklama: s.buAy.aciklama,
        durum: s.buAy.durum,
        // Bugün içinde birkaç saat önce: bildirimler farklı saatlerde gelmiş gibi görünsün diye saatler dağıtılır
        tarih: gunOnce(0, aidatlar.length % 20),
      });
    }
  }
  // collection.insertMany: Mongoose'un otomatik "tarih" alanı yerine yukarıda hesaplanan geçmiş tarihler yazılsın diye
  // doğrudan veritabanı sürücüsüyle eklenir.
  await Aidat.collection.insertMany(aidatlar);

  // Duyurular: biri bugün (listede "Bugün" etiketi ve sakin ana ekranında "yeni duyuru" sayısı görünsün diye)
  await Duyuru.collection.insertMany([
    { siteId, baslik: 'Asansör bakımı', icerik: 'Bugün 14:00–16:00 arası A Blok asansörü bakımda olacaktır. Anlayışınız için teşekkürler.', tarih: gunOnce(0, 2) },
    { siteId, baslik: 'Su kesintisi', icerik: 'İSKİ çalışması nedeniyle perşembe 09:00–13:00 arası sular kesik olacaktır.', tarih: gunOnce(3, 5) },
    { siteId, baslik: 'Genel kurul toplantısı', icerik: 'Yıllık genel kurul ayın 20\'sinde saat 19:00\'da sığınak toplantı odasında yapılacaktır.', tarih: gunOnce(10, 3) },
    { siteId, baslik: 'Bahçe düzenlemesi', icerik: 'Ön bahçeye yeni çiçekler dikildi, çocukların çimlere basmamasına dikkat edelim.', tarih: gunOnce(20, 6) },
  ]);

  // Tekrarlayan duyuru: her pazartesi 08:00'de "Çöp günü" duyurusu otomatik yayınlanır
  await TekrarlananDuyuru.create({
    siteId,
    baslik: 'Çöp günü',
    icerik: 'Bugün geri dönüşüm günü. Lütfen kâğıt ve plastikleri mavi konteynere atınız.',
    gunler: [1],
    saat: 8,
    dakika: 0,
  });

  // Mesajlar: yönetici ile üç sakin arasında. A3'ün son mesajı okunmamış (yöneticide okunmamış sayısı görünür).
  const mesaj = (gonderen, alici, icerik, gun, saat, okundu = true) => ({ siteId, gonderenId: gonderen, aliciId: alici, icerik, okundu, tarih: gunOnce(gun, saat) });
  const Y = yoneticiId;
  await Mesaj.collection.insertMany([
    mesaj(sakinler.A3, Y, 'Merhaba Zeynep Hanım, bu ayın aidatını havaleyle gönderdim.', 1, 5),
    mesaj(Y, sakinler.A3, 'Merhaba Elif Hanım, teşekkürler. Hesaba düşünce onaylayacağım.', 1, 4),
    mesaj(sakinler.A3, Y, 'Bir de mutfakta su sızıntısı var, tesisatçının numarasını alabilir miyim?', 0, 3, false),
    mesaj(Y, sakinler.B4, 'Deniz Bey merhaba, son iki ayın aidatı görünmüyor. Bilginize.', 2, 6),
    mesaj(sakinler.B4, Y, 'Haklısınız, bu hafta sonu hepsini birden ödeyeceğim.', 2, 2),
    mesaj(sakinler.A1, Y, 'Otopark kapısının kumandası çalışmıyor.', 5, 1),
    mesaj(Y, sakinler.A1, 'Servisi aradım, yarın geliyorlar.', 4, 8),
  ]);

  return { daireSayisi: daireler.length, sakinSayisi: SAKINLER.length, aidatSayisi: aidatlar.length };
}

// Ana akış: bağlan → eski demoyu sil → yenisini kur → bağlantıyı kapat. Hata olursa mesaj yazılır, çıkış kodu 1 olur.
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await eskiDemoyuSil();
    const sonuc = await demoKur();
    console.log(`Demo sitesi kuruldu: ${sonuc.daireSayisi} daire, ${sonuc.sakinSayisi} sakin, ${sonuc.aidatSayisi} aidat kaydı.`);
    console.log(`Yönetici: ${YONETICI_EPOSTA}  ·  Sakinler: lale.a1@ornek.com, lale.a3@ornek.com ...  ·  Şifre: ${SIFRE}`);
  } catch (hata) {
    console.error('Demo verisi kurulamadı:', hata.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
