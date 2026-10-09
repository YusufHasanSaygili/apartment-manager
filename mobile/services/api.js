// Ortak API bağlantısı: tüm ekranlar backend'e istekleri bu axios örneği üzerinden atar.
// Böylece adres, zaman aşımı ve hata mesajları gibi ayarlar tek yerde durur.
import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  // Her isteğin başına eklenecek adres, örn. api.get('/saglik') → http://IP:3000/api/saglik
  baseURL: `${API_URL}/api`,
  // Sunucu 10 saniyede cevap vermezse istek hata ile biter; uygulama sonsuza kadar beklemez.
  timeout: 10000,
});

// Axios hatasını kullanıcıya gösterilebilecek Türkçe bir mesaja çevirir.
function buildErrorMessage(error) {
  // Sunucu cevap verdi: backend her hatada { mesaj } döndüğü için onu kullanırız.
  if (error.response) {
    return error.response.data?.mesaj || `Sunucu beklenmeyen bir cevap verdi (${error.response.status}).`;
  }
  // Sunucu süre içinde cevap vermedi.
  if (error.code === 'ECONNABORTED') {
    return 'Sunucu cevap vermedi. Lütfen tekrar deneyin.';
  }
  // Hiç cevap yok: internet yok, sunucu kapalı veya adres yanlış.
  return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
}

// Oturum düşünce çağrılacak fonksiyon. SessionContext, uygulama açılınca bir useEffect içinde
// setSessionDroppedHandler ile kaydeder. api.js bir React component'i olmadığı için
// oturumu kendisi kapatamaz; bu yüzden işi SessionContext'e bırakır.
let sessionDroppedHandler = null;
export function setSessionDroppedHandler(fn) {
  sessionDroppedHandler = fn;
}

// Bağlantı durumu: sunucuya şu an ulaşılabiliyor mu. Her istek sonucu (aşağıdaki interceptor) ve soket
// bağlanıp koptukça (socket.js) güncellenir. "Bağlantı yok" şeridi (ConnectionBanner) bunu dinler.
// Telefonun internete bağlı olması yetmez; asıl önemli olan bilgisayardaki sunucuya ulaşabilmektir.
let isConnected = true;
const connectionListeners = new Set();
export function setConnectionStatus(status) {
  if (status === isConnected) return;
  isConnected = status;
  connectionListeners.forEach((fn) => fn());
}
// useSyncExternalStore için: dinleyici ekleyip kaldırma ve o anki durumu okuma (bkz. ConnectionBanner).
export const subscribeConnection = (fn) => {
  connectionListeners.add(fn);
  return () => connectionListeners.delete(fn);
};
export const getIsConnected = () => isConnected;

// Interceptor (araya giren fonksiyon): her hatalı cevap ekrana ulaşmadan önce buradan geçer.
// Hata tek tip bir nesneye çevrilir; ekranlar sadece error.message'ı göstermekle yetinir,
// her ekranda ayrı ayrı hata ayıklama kodu yazmak gerekmez.
api.interceptors.response.use(
  // Başarılı response: sunucuya ulaşıldı → bağlantı var. Cevap hiç değiştirilmeden ekrana iletilir.
  (response) => {
    setConnectionStatus(true);
    return response;
  },
  // Hatalı response: ortak hata nesnesine çevrilip ekrana fırlatılır (ekranda catch ile yakalanır).
  (error) => {
    // Sunucu cevap verdiyse (400, 404 vb.) bağlantı var; hiç cevap gelmediyse (internet yok, sunucu kapalı,
    // zaman aşımı) bağlantı yok sayılır ve "Bağlantı yok" şeridi çıkar.
    setConnectionStatus(Boolean(error.response));
    const apiError = new Error(buildErrorMessage(error));
    // Ekran gerekirse duruma göre davranabilsin diye HTTP kodu da eklenir (örn. 401 → girişe yönlendir).
    apiError.durumKodu = error.response?.status;
    // 401 + istekte token vardı: oturum artık geçersiz (süresi doldu, hesap silindi veya sakin daireden
    // çıkarıldı). Hangi ekranda olursa olsun oturum kapatılır ve sunucunun mesajı gösterilir.
    // (Giriş ekranındaki "şifre hatalı" 401'inde token olmadığı için bu çalışmaz.)
    if (apiError.durumKodu === 401 && error.config?.headers?.Authorization) {
      sessionDroppedHandler?.(apiError.message);
    }
    return Promise.reject(apiError);
  }
);

// Giriş yapılınca token'ı tüm isteklerin "Authorization" başlığına ekler; böylece backend
// isteği kimin attığını bilir. Çıkışta null verilir ve başlık silinir.
export function setToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
