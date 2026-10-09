// Tekrarlayan duyuruların zamanı gelince yayınlanması: her dakika çalışan bir görev, o gün ve o saat-dakika için
// tanımlanmış tekrarlayan duyuruları bulur, her biri için normal bir duyuru oluşturur ve sitenin herkesine push gönderir.
const cron = require('node-cron');
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const RecurringAnnouncement = require('../models/RecurringAnnouncement');
const { sendPush } = require('./pushNotifications');

// Şu anki günü, saati ve dakikayı TÜRKİYE SAATİNE göre verir. Sunucu başka bir saat diliminde
// çalışsa bile yönetici "08:00" dediyse Türkiye'de 08:00'de yayınlansın diye Intl kullanılır.
// Intl.DateTimeFormat: JavaScript'in hazır tarih biçimlendiricisi; ek kütüphane gerekmez. timeZone verilince
// tarihi o bölgenin saatine çevirir. 'en-US' seçildi ki gün adları her zaman İngilizce kısaltma ('Mon') gelsin
// ve aşağıdaki diziyle karşılaştırılabilsin. hourCycle 'h23': gece yarısı "24" değil "00" yazılsın.
// formatToParts: tarihi tek metin yerine parçalar dizisi olarak verir
// (örn. [{type:'weekday', value:'Mon'}, {type:'hour', value:'08'}, {type:'minute', value:'30'} ...]).
const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // sırası 0 = Pazar ile aynı
// Biçimlendirici bir kez oluşturulur ve her dakika tekrar kullanılır (her seferinde yenisini kurmak gereksiz iş olur).
const turkeyTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function turkeyTime(date) {
  // Parçalar dizisi { weekday: 'Mon', hour: '08', minute: '30', ... } nesnesine çevrilir (Object.fromEntries).
  // Sonra gün adı dizideki sırasına (Mon → 1), saat ve dakika metinleri sayıya çevrilir.
  const part = Object.fromEntries(turkeyTimeFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return { gun: DAY_ABBREVIATIONS.indexOf(part.weekday), saat: Number(part.hour), dakika: Number(part.minute) };
}

// Zamanı gelen tekrarlayan duyuruları yayınlar. Her dakika bir kez çalışır.
async function publishScheduledAnnouncements() {
  const now = new Date();
  const { gun: day, saat: hour, dakika: minute } = turkeyTime(now);
  // Bu dakikanın başlangıcı: sonGonderim bundan önceyse bu dakika henüz yayınlanmamış demektir.
  const minuteStart = new Date(now);
  minuteStart.setSeconds(0, 0);

  // gunler: day → dizinin içinde bu gün VARSA eşleşir (MongoDB dizi alanlarında böyle arar).
  // $or: daha önce hiç gönderilmemiş (null) VEYA en son bu dakikadan önce gönderilmiş olanlar alınır.
  const readyItems = await RecurringAnnouncement.find({
    gunler: day,
    saat: hour,
    dakika: minute,
    $or: [{ sonGonderim: null }, { sonGonderim: { $lt: minuteStart } }],
  }).lean();

  // Bir duyuruda hata olursa diğerleri yarıda kalmasın diye her biri ayrı try/catch içinde.
  for (const t of readyItems) {
    try {
      // "Önce işaretle, sonra yayınla": duyuruyu yayınlamadan ÖNCE kayda "gönderildi" (sonGonderim = şimdi) yazılır.
      // updateOne'ın filtresinde aynı "henüz gönderilmedi" şartı tekrar vardır; yani kontrol ve yazma tek adımda yapılır.
      // Görev aynı dakikada iki kez çalışırsa (örn. sunucu yeniden başladı) ilki kaydı işaretler, ikincisinin
      // filtresi artık tutmaz, hiçbir kayıt değişmez (modifiedCount 0) ve continue ile bu duyuru atlanır.
      // Böylece aynı duyuru iki kez yayınlanmaz.
      const mark = await RecurringAnnouncement.updateOne(
        { _id: t._id, $or: [{ sonGonderim: null }, { sonGonderim: { $lt: minuteStart } }] },
        { sonGonderim: now }
      );
      if (mark.modifiedCount === 0) continue;

      // Normal bir duyuru olarak eklenir: sitedeki herkes duyurular listesinde görür.
      await Announcement.create({ siteId: t.siteId, baslik: t.baslik, icerik: t.icerik });
      // Sitedeki herkese (yönetici dahil, hatırlatma niteliğinde olduğu için) push gönderilir. siteId filtresi: site izolasyonu.
      const recipients = await User.find({ siteId: t.siteId, pushToken: { $ne: null } }).select('pushToken').lean();
      await sendPush(
        recipients.map((k) => k.pushToken),
        { baslik: `Duyuru: ${t.baslik}`, icerik: t.icerik, pushData: { ekran: 'Duyurular' } }
      );
    } catch (error) {
      console.error(`Tekrarlayan duyuru yayınlanamadı (${t._id}):`, error.message);
    }
  }
}

// Görevi kurar; sunucu açılınca bir kez çağrılır (server.js).
// Cron ifadesi '* * * * *': beş alanın hepsi * (her biri) → her dakika çalışır.
// noOverlap: önceki dakikanın çalışması bitmeden yenisi başlamaz.
function scheduleRecurringAnnouncements() {
  cron.schedule('* * * * *', publishScheduledAnnouncements, { name: 'tekrarlanan-duyurular', noOverlap: true });
}

module.exports = { scheduleRecurringAnnouncements };
