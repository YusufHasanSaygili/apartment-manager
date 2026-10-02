// Socket.io bağlantısı (anlık mesajlar): sunucuyla sürekli açık bir bağlantı tutar.
// Sunucu yeni bir mesaj olduğunda telefona kendisi haber verir; ekranlar bu haberi dinleyip
// mesajı sayfa yenilemeden gösterir. Uygulamada tek bir bağlantı vardır, tüm ekranlar onu kullanır.
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';

// Bağlanırken sunucuya gönderilecek oturum token'ı (soketBaglan ile ayarlanır).
let mevcutToken = null;

// Tek bağlantı nesnesi uygulama açılınca oluşturulur ama hemen bağlanmaz (autoConnect: false);
// giriş yapılınca soketBaglan ile bağlanır. Böylece ekranlar olayları her zaman aynı nesneye bağlayabilir.
// transports: ['websocket']: React Native'de doğrudan WebSocket kullanılır (daha hızlı ve kararlı).
// auth fonksiyonu: her bağlanma/yeniden bağlanma denemesinde güncel token'ı sunucuya gönderir;
// sunucu token'ı doğrulamazsa bağlantıyı reddeder.
const soket = io(API_URL, {
  autoConnect: false,
  transports: ['websocket'],
  auth: (gonder) => gonder({ token: mevcutToken }),
});

// Sunucu bağlantıyı reddederse (örn. o an veritabanına ulaşamadı) Socket.io kendiliğinden tekrar
// denemez; soket.active false olur. Oturum hâlâ açıksa 5 saniye sonra yeniden bağlanmayı deneriz,
// yoksa anlık mesajlar uygulama yeniden açılana kadar sessizce dururdu.
soket.on('connect_error', () => {
  if (mevcutToken && !soket.active) setTimeout(() => mevcutToken && soket.connect(), 5000);
});

// Giriş yapılınca (veya kayıtlı oturumla açılınca) çağrılır: token'ı ayarlar ve bağlanır.
// Bağlantı koparsa (internet gitti, uygulama arka plana alındı) Socket.io kendiliğinden yeniden bağlanır.
// Önce disconnect: önceden açık bir bağlantı varsa (örn. başka hesapla giriş) kapatılır, yeni token ile
// sıfırdan bağlanılır; yoksa sunucu eski hesabın odasında tutmaya devam ederdi.
export function soketBaglan(token) {
  mevcutToken = token;
  soket.disconnect().connect();
}

// Çıkış yapılınca çağrılır: bağlantıyı kapatır ve token'ı unutur.
export function soketKes() {
  mevcutToken = null;
  soket.disconnect();
}

// Ekranların soket olaylarını dinlemesi için hook. Ekran açıkken olay dinlenir, ekran kapanınca
// (veya isleyici değişince) dinleme bırakılır; böylece kapanmış ekrana mesaj eklenmeye çalışılmaz.
// olay: örn. 'yeniMesaj' (yeni mesaj geldi) veya 'connect' (bağlantı kuruldu/yeniden kuruldu).
// isleyici: olay gelince çalışacak fonksiyon; her çizimde yeniden kurulmaması için useCallback ile verilmeli.
export function useSoketOlayi(olay, isleyici) {
  // useEffect: dinleyiciyi ekler; döndürdüğü temizlik fonksiyonu ekran kapanınca dinleyiciyi kaldırır.
  useEffect(() => {
    soket.on(olay, isleyici);
    return () => {
      soket.off(olay, isleyici);
    };
  }, [olay, isleyici]);
}
