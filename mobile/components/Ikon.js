// Uygulamaya özel çizilmiş ikon seti (Gece Gold tasarımı). Çizimler tasarim-onizleme/ikonlar.js ile aynıdır.
// Her ikon 24x24'lük bir kutuya çizilmiş SVG parçasıdır. react-native-svg kütüphanesindeki SvgXml bu metni
// telefonda vektör olarak çizer; vektör olduğu için her boyutta keskin görünür, resim dosyası gerekmez.
// "currentColor" ikonun rengidir (aşağıdaki renk prop'u buraya gelir). fill-opacity="0.2" olan parçalar
// aynı rengin şeffaf tonudur; ikon tek renk kalır ama iki tonlu, daha zengin görünür.
import { SvgXml } from 'react-native-svg';
import { renkler } from '../tema';

// İkon adı → SVG parçaları. "ARKA" yazan yer ikonun durduğu zeminin rengiyle doldurulur
// (bekleyen ikonundaki saat, arkasındaki paraların önünde dursun diye).
const YOLLAR = {
  // Aidat durumları: ödedi (içinde ₺ olan madeni para), bekliyor (saat), ödemedi (yarım halka + ünlem),
  // sakin yok (aralık kalmış kapı), henüz gelmedi (dönen ok + takvim), katılmadan önce (kesikli halka)
  odedi: '<circle fill="currentColor" fill-opacity="0.2" cx="12" cy="12" r="8.8"/><circle cx="12" cy="12" r="6.5" stroke-width="1.3" stroke-dasharray="1.1 1.7"/><path d="M11 7.8v8.6c2.3 0 3.9-1.6 3.9-3.9M9.3 11.4l4.2-1.6M9.3 13.6l4.2-1.6"/>',
  bekliyor: '<circle fill="currentColor" fill-opacity="0.2" cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2.1"/><path d="M12 3.5v1.2M20.5 12h-1.2M12 20.5v-1.2M3.5 12h1.2" stroke-width="1.3"/>',
  odemedi: '<path d="M16.6 4.6A8.5 8.5 0 1 0 20.4 10.4"/><path fill="currentColor" fill-opacity="0.2" stroke="none" d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z"/><path d="M12 7.6v5.3"/><circle cx="12" cy="16.3" r="1" fill="currentColor" stroke="none"/>',
  yok: '<path d="M5.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 18.5 5v15.5"/><path fill="currentColor" fill-opacity="0.2" d="M7.5 4.6 13 6.4v14.1l-5.5-.4Z"/><path d="M3.5 20.5h17"/><circle cx="11.4" cy="13" r=".8" fill="currentColor" stroke="none"/>',
  gelecek: '<g><path d="M12 3a9 9 0 1 1-7.8 4.5"/><path d="M1.7 8.4 4.2 7.5l.6 2.7"/></g><rect fill="currentColor" fill-opacity="0.2" x="8.3" y="9.6" width="7.4" height="6.2" rx="1.2"/><path d="M8.3 11.9h7.4M10.4 8.6v1.8M13.6 8.6v1.8"/>',
  // "Henüz gelmedi" ikonunun iki parçası ayrı ayrı: ok döner (AyKutusu'nda), takvim sabit kalır
  gelecekOk: '<path d="M12 3a9 9 0 1 1-7.8 4.5"/><path d="M1.7 8.4 4.2 7.5l.6 2.7"/>',
  gelecekTakvim: '<rect fill="currentColor" fill-opacity="0.2" x="8.3" y="9.6" width="7.4" height="6.2" rx="1.2"/><path d="M8.3 11.9h7.4M10.4 8.6v1.8M13.6 8.6v1.8"/>',
  sakin: '<circle fill="currentColor" fill-opacity="0.2" cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.2c1-3.7 3.8-5.8 7.2-5.8s6.2 2.1 7.2 5.8"/>',
  once: '<circle cx="12" cy="12" r="8" stroke-dasharray="2.6 2.9"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',

  // Ana ekran kutucukları ve butonlar
  bekleyen: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M3 9.4v8.1c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3V9.4"/><ellipse fill="currentColor" fill-opacity="0.2" cx="8.5" cy="9.4" rx="5.5" ry="2.2"/><path d="M3 9.4v8.1c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3V9.4M3 12.1c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3M3 14.8c0 1.3 2.5 2.3 5.5 2.3s5.5-1 5.5-2.3"/><circle cx="17.4" cy="7" r="4.3" fill="ARKA" stroke="none"/><circle cx="17.4" cy="7" r="4.3"/><path d="M17.4 4.9v2.3l1.5 1" stroke-width="1.3"/>',
  harita: '<rect fill="currentColor" fill-opacity="0.2" stroke="none" x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6" stroke-dasharray="2.4 2.2"/>',
  anahtar: '<circle fill="currentColor" fill-opacity="0.2" stroke="none" cx="7.5" cy="12" r="4.5"/><circle cx="7.5" cy="12" r="4.5"/><circle cx="7.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><path d="M12 12h9M17.2 12v3.2M20.2 12v2.4"/>',
  duyuru: '<path fill="currentColor" fill-opacity="0.2" d="M5 10.1 15 5.6v12.8L5 13.9Z"/><rect x="2.6" y="10" width="2.4" height="4" rx=".9"/><ellipse cx="15" cy="12" rx="1.5" ry="6.4"/><path d="M8.4 12.8 9.6 18.4h2.1L10.8 13.8M19.2 9.6a3.4 3.4 0 0 1 0 4.8M21.4 7.6a6.4 6.4 0 0 1 0 8.8"/>',
  mesaj: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v7.3a2.6 2.6 0 0 1-2.6 2.6H11l-4.7 3.8v-3.8A2.6 2.6 0 0 1 4 13.9Z"/><path d="M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v7.3a2.6 2.6 0 0 1-2.6 2.6H11l-4.7 3.8v-3.8A2.6 2.6 0 0 1 4 13.9Z"/><circle cx="8.4" cy="10.3" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="10.3" r="1" fill="currentColor" stroke="none"/><circle cx="15.6" cy="10.3" r="1" fill="currentColor" stroke="none"/>',
  zil: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4Z"/><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4Z"/><path d="M10 21a2.1 2.1 0 0 0 4 0M2.8 8.6a9 9 0 0 1 2.3-4.2M21.2 8.6a9 9 0 0 0-2.3-4.2"/>',
  lira: '<rect fill="currentColor" fill-opacity="0.2" x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M5.8 9.6h.01M18.2 14.4h.01" stroke-width="2.6"/>',
  devret: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="m8.2 10.2-1-5 3 2.1L12 4l1.8 3.3 3-2.1-1 5Z"/><path d="m8.2 10.2-1-5 3 2.1L12 4l1.8 3.3 3-2.1-1 5Z"/><path d="M4 14.4h14l-2.6-2.6M20 18.6H6l2.6 2.6"/>',
  takvim: '<rect fill="currentColor" fill-opacity="0.2" stroke="none" x="3.5" y="5" width="17" height="15.5" rx="2.6"/><rect x="3.5" y="5" width="17" height="15.5" rx="2.6"/><path d="M3.5 9.6h17M8 3v3.6M16 3v3.6"/><circle cx="8" cy="13.2" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="13.2" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="16.8" r=".9" fill="currentColor" stroke="none"/><path d="M16 12.2c.2 1.1.7 1.6 1.8 1.8-1.1.2-1.6.7-1.8 1.8-.2-1.1-.7-1.6-1.8-1.8 1.1-.2 1.6-.7 1.8-1.8Z"/>',
  aidatGonder: '<path fill="currentColor" fill-opacity="0.2" d="M5.5 3.5h13v17l-2.17-1.4-2.16 1.4-2.17-1.4-2.17 1.4-2.16-1.4-2.17 1.4Z"/><path d="M8.6 8h6.8M8.6 11.5h6.8M8.6 15h3.4"/><path d="m14.2 15.1 1.3 1.3 2.3-2.5"/>',
  tekrar: '<path d="M20 12a8 8 0 0 1-13.6 5.7M4 12a8 8 0 0 1 13.6-5.7"/><path d="M17.9 2.9v3.6h-3.6M6.1 21.1v-3.6h3.6"/><circle fill="currentColor" fill-opacity="0.2" stroke="none" cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="3"/>',
  ekle: '<rect fill="currentColor" fill-opacity="0.2" x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>',
  kurulum: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M4 20.5V8.2L11 4l7 4.2v4.3"/><path d="M4 20.5V8.2L11 4l7 4.2v4.3M2.5 20.5h11"/><path d="M8 11h1.6M12.4 11H14M8 14.6h1.6"/><circle cx="17.5" cy="17.5" r="4"/><path d="M17.5 15.6v3.8M15.6 17.5h3.8"/>',
  cikis: '<path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path fill="currentColor" fill-opacity="0.2" stroke="none" d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v16H6.5A2.5 2.5 0 0 1 4 17.5Z"/><path d="M10.5 12H20M16.3 8.2 20 12l-3.7 3.8"/>',
  kalkan: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M12 3.2 19 6v5.6c0 4.3-2.9 7.8-7 9.2-4.1-1.4-7-4.9-7-9.2V6Z"/><path d="M12 3.2 19 6v5.6c0 4.3-2.9 7.8-7 9.2-4.1-1.4-7-4.9-7-9.2V6Z"/><circle cx="12" cy="10.6" r="1.8"/><path d="M12 12.4v3"/>',
  // Hesap silme: kimlik kartı sağ kenarından piksellere dağılıyor
  hesapSil: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M14.5 5.5H4.6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9.9Z"/><path d="M15 8V7.5a2 2 0 0 0-2-2H4.6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2H13a2 2 0 0 0 2-2V16"/><circle cx="7.3" cy="10.4" r="1.9"/><path d="M4.7 15.6c.5-1.5 1.5-2.3 2.6-2.3s2.1.8 2.6 2.3M11.4 10h1.6M11.4 13h1.6"/><rect x="16.1" y="9.1" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/><rect x="18.4" y="11.6" width="2" height="2" rx=".4" fill="currentColor" stroke="none" opacity="0.6"/><rect x="16.3" y="13.6" width="1.8" height="1.8" rx=".4" fill="currentColor" stroke="none" opacity="0.6"/><rect x="20.8" y="8" width="1.6" height="1.6" rx=".4" fill="currentColor" stroke="none" opacity="0.3"/><rect x="21" y="14.6" width="1.4" height="1.4" rx=".4" fill="currentColor" stroke="none" opacity="0.3"/>',
  cop: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M6.5 7.5h11l-.9 12a1.6 1.6 0 0 1-1.6 1.5H9a1.6 1.6 0 0 1-1.6-1.5Z"/><path d="M4.5 7.5h15M9.5 7.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.5M6.5 7.5l.9 12A1.6 1.6 0 0 0 9 21h6a1.6 1.6 0 0 0 1.6-1.5l.9-12M10.3 11.2v5.6M13.7 11.2v5.6"/>',
  uyari: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M10.3 4.4a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z"/><path d="M10.3 4.4a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z"/><path d="M12 9.2v4.4"/><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none"/>',
  // Gönder: hız çizgili kağıt uçak
  gonder: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M21 3 10.2 13.3 13.2 21Z"/><path d="M21 3 3.4 10.4l6.8 2.9L13.2 21Z"/><path d="M21 3 10.2 13.3"/><path d="M2.6 15.6h3.8M4.6 18.8h3.4" opacity="0.55"/>',
  paylas: '<path fill="currentColor" fill-opacity="0.2" stroke="none" d="M5 11v7.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V11"/><path d="M5 11v7.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V11M12 3.5V14M8.2 7.2 12 3.5l3.8 3.7"/>',
  sakinCikar: '<circle fill="currentColor" fill-opacity="0.2" stroke="none" cx="9.5" cy="8" r="3.6"/><circle cx="9.5" cy="8" r="3.6"/><path d="M3.5 20c.9-3.3 3.2-5.2 6-5.2 1.5 0 2.9.5 3.9 1.5M15.5 16.5l5 5M20.5 16.5l-5 5"/>',
};

// ad: ikonun adı (YOLLAR'daki anahtarlardan biri), boyut: piksel cinsinden genişlik ve yükseklik,
// renk: çizgi ve dolgunun rengi, arka: ikonun durduğu zeminin rengi (sadece bekleyen ikonunda kullanılır).
// İkonlar süs amaçlıdır, yanlarında her zaman yazı olur; bu yüzden ekran okuyucudan gizlenir (accessible={false}).
export default function Ikon({ ad, boyut = 20, renk = renkler.yazi, arka = renkler.kart }) {
  // Seçilen ikonun parçaları ortak bir <svg> çerçevesinin içine konur: çerçeve 24x24 çizim alanını, çizgi kalınlığını
  // ve yuvarlak uçları her ikon için bir kez tanımlar. replace: "ARKA" yazan yerlere zemin rengini yazar.
  const xml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${YOLLAR[ad].replace(/ARKA/g, arka)}</svg>`;
  return <SvgXml xml={xml} width={boyut} height={boyut} color={renk} accessible={false} />;
}
