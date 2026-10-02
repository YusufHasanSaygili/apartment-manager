// Tekrarlayan duyuruların zamanı gelince yayınlanması: her dakika çalışan bir görev, o gün ve o saat-dakika için
// tanımlanmış tekrarlayan duyuruları bulur, her biri için normal bir duyuru oluşturur ve sitenin herkesine push gönderir.
const cron = require('node-cron');
const Duyuru = require('../models/Duyuru');
const Kullanici = require('../models/Kullanici');
const TekrarlananDuyuru = require('../models/TekrarlananDuyuru');
const { pushGonder } = require('./bildirim');

// Şu anki günü, saati ve dakikayı TÜRKİYE SAATİNE göre verir. Sunucu başka bir saat diliminde
// çalışsa bile yönetici "08:00" dediyse Türkiye'de 08:00'de yayınlansın diye Intl kullanılır.
// Intl.DateTimeFormat: JavaScript'in hazır tarih biçimlendiricisi; ek kütüphane gerekmez. timeZone verilince
// tarihi o bölgenin saatine çevirir. 'en-US' seçildi ki gün adları her zaman İngilizce kısaltma ('Mon') gelsin
// ve aşağıdaki diziyle karşılaştırılabilsin. hourCycle 'h23': gece yarısı "24" değil "00" yazılsın.
// formatToParts: tarihi tek metin yerine parçalar dizisi olarak verir
// (örn. [{type:'weekday', value:'Mon'}, {type:'hour', value:'08'}, {type:'minute', value:'30'} ...]).
const GUN_KISALTMALARI = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // sırası 0 = Pazar ile aynı
// Biçimlendirici bir kez oluşturulur ve her dakika tekrar kullanılır (her seferinde yenisini kurmak gereksiz iş olur).
const turkiyeSaatiBicimi = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function turkiyeZamani(tarih) {
  // Parçalar dizisi { weekday: 'Mon', hour: '08', minute: '30', ... } nesnesine çevrilir (Object.fromEntries).
  // Sonra gün adı dizideki sırasına (Mon → 1), saat ve dakika metinleri sayıya çevrilir.
  const parca = Object.fromEntries(turkiyeSaatiBicimi.formatToParts(tarih).map((p) => [p.type, p.value]));
  return { gun: GUN_KISALTMALARI.indexOf(parca.weekday), saat: Number(parca.hour), dakika: Number(parca.minute) };
}

// Zamanı gelen tekrarlayan duyuruları yayınlar. Her dakika bir kez çalışır.
async function zamaniGelenleriYayinla() {
  const simdi = new Date();
  const { gun, saat, dakika } = turkiyeZamani(simdi);
  // Bu dakikanın başlangıcı: sonGonderim bundan önceyse bu dakika henüz yayınlanmamış demektir.
  const dakikaBasi = new Date(simdi);
  dakikaBasi.setSeconds(0, 0);

  // gunler: gun → dizinin içinde bu gün VARSA eşleşir (MongoDB dizi alanlarında böyle arar).
  // $or: daha önce hiç gönderilmemiş (null) VEYA en son bu dakikadan önce gönderilmiş olanlar alınır.
  const zamaniGelenler = await TekrarlananDuyuru.find({
    gunler: gun,
    saat,
    dakika,
    $or: [{ sonGonderim: null }, { sonGonderim: { $lt: dakikaBasi } }],
  }).lean();

  // Bir duyuruda hata olursa diğerleri yarıda kalmasın diye her biri ayrı try/catch içinde.
  for (const t of zamaniGelenler) {
    try {
      // "Önce işaretle, sonra yayınla": duyuruyu yayınlamadan ÖNCE kayda "gönderildi" (sonGonderim = şimdi) yazılır.
      // updateOne'ın filtresinde aynı "henüz gönderilmedi" şartı tekrar vardır; yani kontrol ve yazma tek adımda yapılır.
      // Görev aynı dakikada iki kez çalışırsa (örn. sunucu yeniden başladı) ilki kaydı işaretler, ikincisinin
      // filtresi artık tutmaz, hiçbir kayıt değişmez (modifiedCount 0) ve continue ile bu duyuru atlanır.
      // Böylece aynı duyuru iki kez yayınlanmaz.
      const isaret = await TekrarlananDuyuru.updateOne(
        { _id: t._id, $or: [{ sonGonderim: null }, { sonGonderim: { $lt: dakikaBasi } }] },
        { sonGonderim: simdi }
      );
      if (isaret.modifiedCount === 0) continue;

      // Normal bir duyuru olarak eklenir: sitedeki herkes duyurular listesinde görür.
      await Duyuru.create({ siteId: t.siteId, baslik: t.baslik, icerik: t.icerik });
      // Sitedeki herkese (yönetici dahil, hatırlatma niteliğinde olduğu için) push gönderilir. siteId filtresi: site izolasyonu.
      const alicilar = await Kullanici.find({ siteId: t.siteId, pushToken: { $ne: null } }).select('pushToken').lean();
      await pushGonder(
        alicilar.map((k) => k.pushToken),
        { baslik: `Duyuru: ${t.baslik}`, icerik: t.icerik, veri: { ekran: 'Duyurular' } }
      );
    } catch (hata) {
      console.error(`Tekrarlayan duyuru yayınlanamadı (${t._id}):`, hata.message);
    }
  }
}

// Görevi kurar; sunucu açılınca bir kez çağrılır (server.js).
// Cron ifadesi '* * * * *': beş alanın hepsi * (her biri) → her dakika çalışır.
// noOverlap: önceki dakikanın çalışması bitmeden yenisi başlamaz.
function tekrarlananDuyurulariZamanla() {
  cron.schedule('* * * * *', zamaniGelenleriYayinla, { name: 'tekrarlanan-duyurular', noOverlap: true });
}

module.exports = { tekrarlananDuyurulariZamanla };
