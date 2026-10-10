// Push bildirim gönderme: Expo'nun ücretsiz push servisine istek atar; Expo bildirimi
// Firebase (FCM) üzerinden telefonlara iletir. Ek kütüphane gerekmez, Node'un kendi fetch'i kullanılır.
const User = require('../models/User');

// Expo'nun bildirim gönderme adresi. Bildirimler doğrudan telefona değil, önce buraya gönderilir.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// tokens: telefonların Expo push adresleri ("ExponentPushToken[...]").
// İkinci parametre: { title, content, pushData } — pushData, bildirime dokununca uygulamanın ne açacağını bilmesi için.
// Bildirim gönderilemezse ana işlem (örn. duyuru yapmak) bozulmasın diye hata fırlatmaz, sadece loglar.
async function sendPush(tokens, { title, content, pushData = {} }) {
  if (tokens.length === 0) return;

  // Expo bir istekte en fazla 100 bildirim kabul eder; liste 100'lük parçalara bölünür.
  for (let i = 0; i < tokens.length; i += 100) {
    const part = tokens.slice(i, i + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // 5 sn zaman sınırı: Expo cevap vermezse istek iptal edilir; böylece duyuru/aidat onayı yapan
        // kullanıcı bildirim yüzünden yükleniyor ekranında beklemez (hata aşağıdaki catch'e düşer).
        signal: AbortSignal.timeout(5000),
        body: JSON.stringify(
          part.map((to) => ({ to, title, body: content, data: pushData, sound: 'default', channelId: 'default' }))
        ),
      });
      // Expo her bildirim için gönderilen sırayla bir "bilet" (sonuç) döner; tickets[j], part[j]'nin sonucudur.
      const result = await response.json();
      // İstek bütünüyle reddedildiyse (örn. Firebase anahtarı Expo'ya yüklenmemiş) neden loglanır.
      if (result.errors) console.error('Expo push hatası:', JSON.stringify(result.errors));
      const tickets = result.data ?? [];
      // Tek tek başarısız olan bildirimlerin nedeni de loglanır (hata ayıklamayı kolaylaştırır).
      tickets
        .filter((b) => b.status === 'error')
        .forEach((b) => console.error('Bildirim gönderilemedi:', b.details?.error ?? b.message));

      // Uygulaması silinmiş veya bildirimi kapatmış telefonların token'ı artık geçersizdir
      // (DeviceNotRegistered); veritabanından temizlenir ki boşuna bildirim gönderilmesin.
      // Sorgu token'ın kendisiyle yapılır; sadece pushToken alanı silinir, başka veri okunmaz.
      const invalidOnes = part.filter((_, j) => tickets[j]?.details?.error === 'DeviceNotRegistered');
      if (invalidOnes.length > 0) {
        await User.updateMany({ pushToken: { $in: invalidOnes } }, { pushToken: null });
      }
    } catch (error) {
      console.error('Push bildirim gönderilemedi:', error.message);
    }
  }
}

// Bildirim metinlerinde ay numarası yerine adı yazılsın diye ("10/2026" değil "Ekim 2026").
const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
// month 1-12 arasıdır; dizi 0'dan başladığı için month - 1 ile doğru ay adı alınır (1 → "Ocak").
const monthText = (month, year) => `${MONTH_NAMES[month - 1]} ${year}`;

// sendPush ve monthText dışarı açılır: duyuru ve aidat route'ları bildirim göndermek için bunları kullanır.
module.exports = { sendPush, monthText };
