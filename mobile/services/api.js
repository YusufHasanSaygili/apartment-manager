// Ortak API bağlantısı: tüm ekranlar backend'e istekleri bu axios örneği üzerinden atar.
// Böylece adres ve zaman aşımı gibi ayarlar tek yerde durur.
import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  // Her isteğin başına eklenecek adres, örn. api.get('/saglik') → http://IP:3000/api/saglik
  baseURL: `${API_URL}/api`,
  // Sunucu 10 saniyede cevap vermezse istek hata ile biter; uygulama sonsuza kadar beklemez.
  timeout: 10000,
});

export default api;
