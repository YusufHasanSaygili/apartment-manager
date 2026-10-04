// Uygulamanın tasarım ayarları ("Gece Gold" teması): tüm ekranlar renkleri, yazı tipini ve köşe yuvarlaklığını
// buradan alır. Bir değer burada değişince bütün uygulama aynı anda güncellenir; ekranlarda rastgele renk
// kodları birikmez. Tasarımın tamamı tasarim-onizleme/ klasöründeki önizleme sayfasında görülebilir.
// Renk düzeni üçlüdür: altın (ana işlem), zümrüt (ikinci vurgu), koyu yeşilimsi nötr zemin.
export const renkler = {
  // Zemin ve yüzeyler: siyaha yakın yeşilimsi gece tonu, üst üste binen katmanlar biraz daha açık
  arkaPlan: '#0A100D', // ekranın zemini
  kart: '#121B17', // kartlar, form kutuları
  yuzey2: '#18241F', // ikincil butonlar, kart içindeki kutular
  yuzey3: '#203029', // rozetler, ikon kutuları
  kenarlik: '#22332B', // ince çerçeveler
  kenarlikGuclu: '#36503F', // daha belirgin çerçeve (ayırıcı çizgi, öne çıkması gereken kutu)

  // Yazı renkleri
  yazi: '#EEF4F0', // başlıklar ve ana metin
  soluk: '#93A59B', // açıklama ve yardımcı metin
  sonuk: '#5F7268', // en az önemli metin (örnek yazı, pasif öğe)

  // Altın: ana işlem butonları ve vurgu. birincilUzeri: altın üstündeki yazı (koyu, okunaklı)
  birincil: '#F2BC32',
  birincilUzeri: '#1E1503',
  birincilZemin: '#3A2C08', // seçili kutunun koyu altın zemini

  // Zümrüt: ikinci vurgu (adım numaraları, göreli tarih, rol etiketi, gönderilen mesaj balonu)
  zumrut: '#34D399',
  zumrutZemin: '#0D3226',
  zumrutCizgi: '#1E7A57',
  zumrutDolgu: '#10B981',
  zumrutUzeri: '#032019',
  balon: '#123628', // gönderilen mesaj balonu (koyu zümrüt, göz yormaz)
  balonYazi: '#E9F7F0',

  // Aidat durum renkleri: yeşil = ödendi, sarı = onay bekliyor, kırmızı = ödenmedi / hata.
  // Kutuların koyu dolgu ve çerçeve tonları Durum.js içinde karistir() ile bu renklerden üretilir;
  // hata için ayrıca sabit Zemin (koyu dolgu) ve Cizgi (çerçeve) tonu var (hata kutusu, hesap silme).
  basarili: '#2FE39A',
  uyari: '#FFC633',
  hata: '#EC4E40',
  hataZemin: '#3F1410',
  hataCizgi: '#93302A',
  hataDolgu: '#C9372B', // kırmızı buton zemini: beyaz yazı okunaklı olsun diye biraz daha koyu
  yok: '#62756B', // sakini olmayan daire / boş ay
};

// Yazı tipleri: Geist (metin) ve Geist Mono (sayılar, kodlar, küçük etiketler). app.json'daki expo-font
// eklentisi bunları uygulamanın içine gömer; fontWeight ile kalınlık seçilir (Geist: 400-700, Geist Mono: 400-600).
// Gömülü oldukları için uygulama açılırken yazı tipinin yüklenmesini beklemek gerekmez (useFonts kullanılmaz).
export const yaziTipi = {
  metin: 'Geist',
  mono: 'Geist Mono',
};

// Köşeli tasarım: butonlar, kartlar ve kutular hafif yuvarlatılmış keskin köşelerle çizilir.
export const kose = 4;

// İki rengi karıştırır: karistir(yesil, 0.15) → yeşilin %15'i + kart renginin %85'i.
// Durum kutularının koyu zemin üstünde hafif renkli görünmesi (plastik dolgu yerine ince ton) için kullanılır.
export function karistir(renk, oran, zemin = renkler.kart) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(renk), rgb(zemin)];
  return '#' + a.map((x, i) => Math.round(x * oran + b[i] * (1 - oran)).toString(16).padStart(2, '0')).join('');
}

// Ortak yazı stilleri: küçük monospace etiket (büyük harf metni ekranda toLocaleUpperCase('tr-TR') ile yazılır)
// ve açıklama metni. Ekranlar bunları kendi StyleSheet'lerine yaymadan doğrudan kullanır.
export const yazilar = {
  etiket: { fontFamily: yaziTipi.mono, fontSize: 11, fontWeight: '500', letterSpacing: 0.8, color: renkler.soluk },
  aciklama: { fontFamily: yaziTipi.metin, fontSize: 14, lineHeight: 20, color: renkler.soluk },
  baslik: { fontFamily: yaziTipi.metin, fontSize: 17, fontWeight: '600', color: renkler.yazi },
};
