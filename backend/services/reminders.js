// Aidat hatırlatma: o ayın aidatını ödemeyen dairelerin sakinlerine push bildirim gönderir.
// İki şekilde çalışır: her ayın 10'unda otomatik (node-cron) ve yöneticinin "Hatırlatma gönder" butonuyla.
const cron = require('node-cron');
const Due = require('../models/Due');
const User = require('../models/User');
const Site = require('../models/Site');
const { sendPush, monthText } = require('./pushNotifications');

// Bir sitenin seçilen ay için ödemeyen sakinlerine hatırlatma gönderir.
// "Ödemeyen" kuralı renkli daire haritasındaki kırmızı ile aynıdır:
// - o ay için onaylanmış veya onay bekleyen bir aidat kaydı yoksa (yöneticinin elle "ödendi"
//   işaretlediği aylar da onaylı kayıttır, onlara hatırlatma gitmez),
// - ve sakin o aydan önce veya o ay katılmışsa (sonradan katılan sakin eski ay için uyarılmaz).
// Dönen değer: { unpaidCount: ödemeyen daire sayısı, notifiedCount: bildirimi açık olup gönderilen sakin sayısı }.
async function sendSiteReminder(siteId, month, year) {
  // Sorguların hepsi siteId ile filtrelenir: bir sitenin hatırlatması başka sitenin sakinine gitmez.
  // Promise.all: iki sorgu birbirini beklemeden aynı anda çalışır, ikisi de bitince sonuçlar birlikte gelir.
  // 1) dairesi olan sakinler (katılma tarihi ve push adresiyle), 2) o ay ödemesi bekleyen/onaylı aidatlar.
  // Katılma tarihi = daireye giriş tarihi (moveInDate, eski kayıtlarda createdAt); ikisi de seçilir ki
  // User.moveInDateOf doğru hesaplayabilsin. role: 'resident' filtresi yüzünden yöneticiye hatırlatma gitmez.
  const [residents, paidOnes] = await Promise.all([
    User.find({ siteId, role: 'resident', flatId: { $ne: null } }).select('flatId moveInDate createdAt pushToken').lean(),
    Due.find({ siteId, month, year, status: { $in: ['pending', 'approved'] } }).select('flatId').lean(),
  ]);

  // Set: o ay ödemesi olan dairelerin kimlikleri; "bu daire ödedi mi?" sorusunu hızlıca cevaplar.
  const paidFlats = new Set(paidOnes.map((a) => String(a.flatId)));
  // Ay sırası (year * 12 + month): ayı tek bir sayıya çevirir, böylece "bu ay, sakinin katıldığı aydan önce mi?"
  // tek bir >= karşılaştırmasıyla anlaşılır. Sakinin katılma ayı da aynı formülle hesaplanır (Due.monthIndex).
  const selectedIndex = year * 12 + month;
  const unpaidFlats = residents.filter(
    (s) => !paidFlats.has(String(s.flatId)) && selectedIndex >= Due.monthIndex(User.moveInDateOf(s))
  );

  // Bildirimi kapalı (pushToken'ı olmayan) sakinlere gönderilemez; filter(Boolean) boş olanları atar.
  const tokens = unpaidFlats.map((s) => s.pushToken).filter(Boolean);
  await sendPush(tokens, {
    title: 'Aidat hatırlatması',
    content: `${monthText(month, year)} aidatınız henüz ödenmedi. Ödediyseniz uygulamadan bildirim gönderebilirsiniz.`,
    pushData: { screen: 'ReportPayment' },
  });

  return { unpaidCount: unpaidFlats.length, notifiedCount: tokens.length };
}

// Tüm sitelere bu ayın hatırlatmasını gönderir (otomatik görev bunu çalıştırır).
// Bir sitede hata olursa diğer sitelerin hatırlatması yarıda kalmasın diye her site ayrı try/catch içindedir.
async function remindAllSites() {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth 0'dan başlar (Ocak = 0), bu yüzden +1
  const year = now.getFullYear();
  const sites = await Site.find().select('_id').lean();
  for (const site of sites) {
    try {
      await sendSiteReminder(site._id, month, year);
    } catch (error) {
      console.error(`Aidat hatırlatması gönderilemedi (site ${site._id}):`, error.message);
    }
  }
  console.log(`Aidat hatırlatması çalıştı: ${sites.length} site`);
}

// Otomatik görevi kurar; sunucu açılınca bir kez çağrılır (server.js).
// node-cron: "şu zamanlarda şu fonksiyonu çalıştır" diye görev tanımlamayı sağlayan kütüphane.
// cron.schedule(ne zaman, ne çalışsın, ayarlar) → zamanı gelince remindAllSites kendiliğinden çalışır.
// Görev sunucu içinde çalışır: o saatte sunucu kapalıysa o ayın otomatik hatırlatması atlanır.
// Cron ifadesi: "ne zaman çalışsın?" bilgisini boşlukla ayrılmış 5 alanla yazar. Soldan sağa:
//   '0     10    10       *    *'
//   dakika saat  ayın-günü ay   haftanın-günü
// Sayı = "tam bu değer", * = "her biri / fark etmez" demektir.
// Yani: dakika 0, saat 10, ayın 10'u, her ay, haftanın hangi günü olursa olsun → her ayın 10'unda saat 10:00.
// timezone: sunucu başka bir ülkede çalışsa bile Türkiye saatine göre çalışır.
// noOverlap: önceki çalışma bitmeden aynı görev ikinci kez başlamaz.
function scheduleReminders() {
  cron.schedule('0 10 10 * *', remindAllSites, {
    name: 'due-reminders',
    timezone: 'Europe/Istanbul',
    noOverlap: true,
  });
}

module.exports = { sendSiteReminder, scheduleReminders };
