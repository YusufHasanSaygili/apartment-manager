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
function hataMesajiOlustur(hata) {
  // Sunucu cevap verdi: backend her hatada { mesaj } döndüğü için onu kullanırız.
  if (hata.response) {
    return hata.response.data?.mesaj || `Sunucu beklenmeyen bir cevap verdi (${hata.response.status}).`;
  }
  // Sunucu süre içinde cevap vermedi.
  if (hata.code === 'ECONNABORTED') {
    return 'Sunucu cevap vermedi. Lütfen tekrar deneyin.';
  }
  // Hiç cevap yok: internet yok, sunucu kapalı veya adres yanlış.
  return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';
}

// Interceptor (araya giren fonksiyon): her hatalı cevap ekrana ulaşmadan önce buradan geçer.
// Hata tek tip bir nesneye çevrilir; ekranlar sadece hata.message'ı göstermekle yetinir,
// her ekranda ayrı ayrı hata ayıklama kodu yazmak gerekmez.
api.interceptors.response.use(
  // Başarılı cevap: hiç değiştirilmeden ekrana iletilir.
  (cevap) => cevap,
  // Hatalı cevap: ortak hata nesnesine çevrilip ekrana fırlatılır (ekranda catch ile yakalanır).
  (hata) => {
    const ortakHata = new Error(hataMesajiOlustur(hata));
    // Ekran gerekirse duruma göre davranabilsin diye HTTP kodu da eklenir (örn. 401 → girişe yönlendir).
    ortakHata.durumKodu = hata.response?.status;
    return Promise.reject(ortakHata);
  }
);

export default api;
