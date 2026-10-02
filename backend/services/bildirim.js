// Push bildirim gönderme: Expo'nun ücretsiz push servisine istek atar; Expo bildirimi
// Firebase (FCM) üzerinden telefonlara iletir. Ek kütüphane gerekmez, Node'un kendi fetch'i kullanılır.
const Kullanici = require('../models/Kullanici');

// Expo'nun bildirim gönderme adresi. Bildirimler doğrudan telefona değil, önce buraya gönderilir.
const EXPO_PUSH_ADRESI = 'https://exp.host/--/api/v2/push/send';

// tokenlar: telefonların Expo push adresleri ("ExponentPushToken[...]").
// mesaj: { baslik, icerik, veri } — veri, bildirime dokununca uygulamanın ne açacağını bilmesi için.
// Bildirim gönderilemezse ana işlem (örn. duyuru yapmak) bozulmasın diye hata fırlatmaz, sadece loglar.
async function pushGonder(tokenlar, { baslik, icerik, veri = {} }) {
  if (tokenlar.length === 0) return;

  // Expo bir istekte en fazla 100 bildirim kabul eder; liste 100'lük parçalara bölünür.
  for (let i = 0; i < tokenlar.length; i += 100) {
    const parca = tokenlar.slice(i, i + 100);
    try {
      const cevap = await fetch(EXPO_PUSH_ADRESI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          parca.map((to) => ({ to, title: baslik, body: icerik, data: veri, sound: 'default', channelId: 'varsayilan' }))
        ),
      });
      // Expo her bildirim için gönderilen sırayla bir "bilet" (sonuç) döner; biletler[j], parca[j]'nin sonucudur.
      const sonuc = await cevap.json();
      // İstek bütünüyle reddedildiyse (örn. Firebase anahtarı Expo'ya yüklenmemiş) neden loglanır.
      if (sonuc.errors) console.error('Expo push hatası:', JSON.stringify(sonuc.errors));
      const biletler = sonuc.data ?? [];
      // Tek tek başarısız olan bildirimlerin nedeni de loglanır (hata ayıklamayı kolaylaştırır).
      biletler
        .filter((b) => b.status === 'error')
        .forEach((b) => console.error('Bildirim gönderilemedi:', b.details?.error ?? b.message));

      // Uygulaması silinmiş veya bildirimi kapatmış telefonların token'ı artık geçersizdir
      // (DeviceNotRegistered); veritabanından temizlenir ki boşuna bildirim gönderilmesin.
      // Sorgu token'ın kendisiyle yapılır; sadece pushToken alanı silinir, başka veri okunmaz.
      const gecersizler = parca.filter((_, j) => biletler[j]?.details?.error === 'DeviceNotRegistered');
      if (gecersizler.length > 0) {
        await Kullanici.updateMany({ pushToken: { $in: gecersizler } }, { pushToken: null });
      }
    } catch (hata) {
      console.error('Push bildirim gönderilemedi:', hata.message);
    }
  }
}

module.exports = { pushGonder };
