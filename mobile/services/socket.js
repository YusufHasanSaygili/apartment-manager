// Socket.io bağlantısı (anlık mesajlar): sunucuyla sürekli açık bir bağlantı tutar.
// Sunucu yeni bir mesaj olduğunda telefona kendisi haber verir; ekranlar bu haberi dinleyip
// mesajı sayfa yenilemeden gösterir. Uygulamada tek bir bağlantı vardır, tüm ekranlar onu kullanır.
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { setConnectionStatus } from './api';

// Bağlanırken sunucuya gönderilecek oturum token'ı (connectSocket ile ayarlanır).
let currentToken = null;

// Tek bağlantı nesnesi uygulama açılınca oluşturulur ama hemen bağlanmaz (autoConnect: false);
// giriş yapılınca connectSocket ile bağlanır. Böylece ekranlar olayları her zaman aynı nesneye bağlayabilir.
// transports: ['websocket']: React Native'de doğrudan WebSocket kullanılır (daha hızlı ve kararlı).
// auth fonksiyonu: her bağlanma/yeniden bağlanma denemesinde güncel token'ı sunucuya gönderir;
// sunucu token'ı doğrulamazsa bağlantıyı reddeder.
const socket = io(API_URL, {
  autoConnect: false,
  transports: ['websocket'],
  auth: (send) => send({ token: currentToken }),
});

// Sunucu bağlantıyı reddederse (örn. o an veritabanına ulaşamadı) Socket.io kendiliğinden tekrar
// denemez; socket.active false olur. Oturum hâlâ açıksa 5 saniye sonra yeniden bağlanmayı deneriz,
// yoksa anlık mesajlar uygulama yeniden açılana kadar sessizce dururdu.
socket.on('connect_error', () => {
  if (currentToken && !socket.active) setTimeout(() => currentToken && socket.connect(), 5000);
});

// Soket bağlandıysa sunucuya ulaşılıyor demektir → "Bağlantı yok" şeridi kalkar.
// Bağlantı kendiliğinden koptuysa (internet gitti, sunucu kapandı) şerit çıkar. Çıkış yapınca bizim
// kapattığımız kopuş ('io client disconnect') ve sunucunun bizi bilerek kopardığı durum ('io server disconnect':
// hesap silindi, daireden çıkarıldı, şifre değişti) bağlantı sorunu değildir, şerit çıkmaz.
socket.on('connect', () => setConnectionStatus(true));
socket.on('disconnect', (reason) => {
  if (reason !== 'io client disconnect' && reason !== 'io server disconnect') setConnectionStatus(false);
});

// Giriş yapılınca (veya kayıtlı oturumla açılınca) çağrılır: token'ı ayarlar ve bağlanır.
// Bağlantı koparsa (internet gitti, uygulama arka plana alındı) Socket.io kendiliğinden yeniden bağlanır.
// Önce disconnect: önceden açık bir bağlantı varsa (örn. başka hesapla giriş) kapatılır, yeni token ile
// sıfırdan bağlanılır; yoksa sunucu eski hesabın odasında tutmaya devam ederdi.
export function connectSocket(token) {
  currentToken = token;
  socket.disconnect().connect();
}

// Çıkış yapılınca çağrılır: bağlantıyı kapatır ve token'ı unutur.
export function disconnectSocket() {
  currentToken = null;
  socket.disconnect();
}

// Ekranların soket olaylarını dinlemesi için hook. Ekran açıkken olay dinlenir, ekran kapanınca
// (veya handler değişince) dinleme bırakılır; böylece kapanmış ekrana mesaj eklenmeye çalışılmaz.
// event: örn. 'yeniMesaj' (yeni mesaj geldi) veya 'connect' (bağlantı kuruldu/yeniden kuruldu).
// handler: olay gelince çalışacak fonksiyon; her çizimde yeniden kurulmaması için useCallback ile verilmeli.
export function useSocketEvent(event, handler) {
  // useEffect: dinleyiciyi ekler; döndürdüğü temizlik fonksiyonu ekran kapanınca dinleyiciyi kaldırır.
  useEffect(() => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}
