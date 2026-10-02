// Aidat hatırlatma: o ayın aidatını ödemeyen dairelerin sakinlerine push bildirim gönderir.
// İki şekilde çalışır: her ayın 10'unda otomatik (node-cron) ve yöneticinin "Hatırlatma gönder" butonuyla.
const cron = require('node-cron');
const Aidat = require('../models/Aidat');
const Kullanici = require('../models/Kullanici');
const Site = require('../models/Site');
const { pushGonder, ayYazisi } = require('./bildirim');

// Bir sitenin seçilen ay için ödemeyen sakinlerine hatırlatma gönderir.
// "Ödemeyen" kuralı renkli daire haritasındaki kırmızı ile aynıdır:
// - o ay için onaylanmış veya onay bekleyen bir aidat kaydı yoksa (yöneticinin elle "ödendi"
//   işaretlediği aylar da onaylı kayıttır, onlara hatırlatma gitmez),
// - ve sakin o aydan önce veya o ay katılmışsa (sonradan katılan sakin eski ay için uyarılmaz).
// Dönen değer: { odemeyen: ödemeyen daire sayısı, bildirimGiden: bildirimi açık olup gönderilen sakin sayısı }.
async function siteyeHatirlatmaGonder(siteId, ay, yil) {
  // Sorguların hepsi siteId ile filtrelenir: bir sitenin hatırlatması başka sitenin sakinine gitmez.
  // Promise.all: iki sorgu birbirini beklemeden aynı anda çalışır, ikisi de bitince sonuçlar birlikte gelir.
  // 1) dairesi olan sakinler (katılma tarihi ve push adresiyle), 2) o ay ödemesi bekleyen/onaylı aidatlar.
  const [sakinler, odenenler] = await Promise.all([
    Kullanici.find({ siteId, rol: 'sakin', daireId: { $ne: null } }).select('daireId createdAt pushToken').lean(),
    Aidat.find({ siteId, ay, yil, durum: { $in: ['bekliyor', 'onaylandi'] } }).select('daireId').lean(),
  ]);

  // Set: o ay ödemesi olan dairelerin kimlikleri; "bu daire ödedi mi?" sorusunu hızlıca cevaplar.
  const odeyenDaireler = new Set(odenenler.map((a) => String(a.daireId)));
  // Ay sırası (yil * 12 + ay): ayı tek bir sayıya çevirir, böylece "bu ay, sakinin katıldığı aydan önce mi?"
  // tek bir >= karşılaştırmasıyla anlaşılır. Sakinin katılma ayı da aynı formülle hesaplanır (Aidat.aySirasi).
  const secilenSira = yil * 12 + ay;
  const odemeyenler = sakinler.filter(
    (s) => !odeyenDaireler.has(String(s.daireId)) && secilenSira >= Aidat.aySirasi(s.createdAt)
  );

  // Bildirimi kapalı (pushToken'ı olmayan) sakinlere gönderilemez; filter(Boolean) boş olanları atar.
  const tokenlar = odemeyenler.map((s) => s.pushToken).filter(Boolean);
  await pushGonder(tokenlar, {
    baslik: 'Aidat hatırlatması',
    icerik: `${ayYazisi(ay, yil)} aidatınız henüz ödenmedi. Ödediyseniz uygulamadan bildirim gönderebilirsiniz.`,
    veri: { ekran: 'AidatBildir' },
  });

  return { odemeyen: odemeyenler.length, bildirimGiden: tokenlar.length };
}

// Tüm sitelere bu ayın hatırlatmasını gönderir (otomatik görev bunu çalıştırır).
// Bir sitede hata olursa diğer sitelerin hatırlatması yarıda kalmasın diye her site ayrı try/catch içindedir.
async function tumSitelereHatirlatma() {
  const simdi = new Date();
  const ay = simdi.getMonth() + 1; // getMonth 0'dan başlar (Ocak = 0), bu yüzden +1
  const yil = simdi.getFullYear();
  const siteler = await Site.find().select('_id').lean();
  for (const site of siteler) {
    try {
      await siteyeHatirlatmaGonder(site._id, ay, yil);
    } catch (hata) {
      console.error(`Aidat hatırlatması gönderilemedi (site ${site._id}):`, hata.message);
    }
  }
  console.log(`Aidat hatırlatması çalıştı: ${siteler.length} site`);
}

// Otomatik görevi kurar; sunucu açılınca bir kez çağrılır (server.js).
// node-cron: "şu zamanlarda şu fonksiyonu çalıştır" diye görev tanımlamayı sağlayan kütüphane.
// cron.schedule(ne zaman, ne çalışsın, ayarlar) → zamanı gelince tumSitelereHatirlatma kendiliğinden çalışır.
// Görev sunucu içinde çalışır: o saatte sunucu kapalıysa o ayın otomatik hatırlatması atlanır.
// Cron ifadesi: "ne zaman çalışsın?" bilgisini boşlukla ayrılmış 5 alanla yazar. Soldan sağa:
//   '0     10    10       *    *'
//   dakika saat  ayın-günü ay   haftanın-günü
// Sayı = "tam bu değer", * = "her biri / fark etmez" demektir.
// Yani: dakika 0, saat 10, ayın 10'u, her ay, haftanın hangi günü olursa olsun → her ayın 10'unda saat 10:00.
// timezone: sunucu başka bir ülkede çalışsa bile Türkiye saatine göre çalışır.
// noOverlap: önceki çalışma bitmeden aynı görev ikinci kez başlamaz.
function hatirlatmayiZamanla() {
  cron.schedule('0 10 10 * *', tumSitelereHatirlatma, {
    name: 'aidat-hatirlatma',
    timezone: 'Europe/Istanbul',
    noOverlap: true,
  });
}

module.exports = { siteyeHatirlatmaGonder, hatirlatmayiZamanla };
