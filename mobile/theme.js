// Uygulamanın tasarım ayarları ("Gece Gold" teması): tüm ekranlar renkleri, yazı tipini ve köşe yuvarlaklığını
// buradan alır. Bir değer burada değişince bütün uygulama aynı anda güncellenir; ekranlarda rastgele renk
// kodları birikmez. Tasarımın tamamı tasarim-onizleme/ klasöründeki önizleme sayfasında görülebilir.
// Renk düzeni üçlüdür: altın (ana işlem), zümrüt (ikinci vurgu), koyu yeşilimsi nötr zemin.
export const colors = {
  // Zemin ve yüzeyler: siyaha yakın yeşilimsi gece tonu, üst üste binen katmanlar biraz daha açık
  background: '#0A100D', // ekranın zemini
  card: '#121B17', // kartlar, form kutuları
  surface2: '#18241F', // ikincil butonlar, kart içindeki kutular
  surface3: '#203029', // rozetler, ikon kutuları
  border: '#22332B', // ince çerçeveler
  borderStrong: '#36503F', // daha belirgin çerçeve (ayırıcı çizgi, öne çıkması gereken kutu)

  // Yazı renkleri
  text: '#EEF4F0', // başlıklar ve ana metin
  muted: '#93A59B', // açıklama ve yardımcı metin
  faint: '#5F7268', // en az önemli metin (örnek yazı, pasif öğe)

  // Altın: ana işlem butonları ve vurgu. onPrimary: altın üstündeki yazı (koyu, okunaklı)
  primary: '#F2BC32',
  onPrimary: '#1E1503',
  primaryBackground: '#3A2C08', // seçili kutunun koyu altın zemini

  // Zümrüt: ikinci vurgu (adım numaraları, göreli tarih, rol etiketi, gönderilen mesaj balonu)
  emerald: '#34D399',
  emeraldBackground: '#0D3226',
  emeraldBorder: '#1E7A57',
  emeraldFill: '#10B981',
  onEmerald: '#032019',
  bubble: '#123628', // gönderilen mesaj balonu (koyu zümrüt, göz yormaz)
  bubbleText: '#E9F7F0',

  // Aidat durum renkleri: yeşil = ödendi, sarı = onay bekliyor, kırmızı = ödenmedi / hata.
  // Kutuların koyu dolgu ve çerçeve tonları Status.js içinde mix() ile bu renklerden üretilir;
  // hata için ayrıca sabit errorBackground (koyu dolgu) ve errorBorder (çerçeve) tonu var (hata kutusu, hesap silme).
  success: '#2FE39A',
  warning: '#FFC633',
  error: '#EC4E40',
  errorBackground: '#3F1410',
  errorBorder: '#93302A',
  errorFill: '#C9372B', // kırmızı buton zemini: beyaz yazı okunaklı olsun diye biraz daha koyu
  none: '#62756B', // sakini olmayan daire / boş ay
};

// Yazı tipleri: Geist (metin) ve Geist Mono (sayılar, kodlar, küçük etiketler). app.json'daki expo-font
// eklentisi bunları uygulamanın içine gömer; fontWeight ile kalınlık seçilir (Geist: 400-700, Geist Mono: 400-600).
// Gömülü oldukları için uygulama açılırken yazı tipinin yüklenmesini beklemek gerekmez (useFonts kullanılmaz).
export const fonts = {
  metin: 'Geist',
  mono: 'Geist Mono',
};

// Köşeli tasarım: butonlar, kartlar ve kutular hafif yuvarlatılmış keskin köşelerle çizilir.
export const radius = 4;

// İki rengi karıştırır: mix(colors.success, 0.15) → yeşilin %15'i + kart renginin %85'i.
// Durum kutularının koyu zemin üstünde hafif renkli görünmesi (plastik dolgu yerine ince ton) için kullanılır.
export function mix(color, ratio, background = colors.card) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(color), rgb(background)];
  return '#' + a.map((x, i) => Math.round(x * ratio + b[i] * (1 - ratio)).toString(16).padStart(2, '0')).join('');
}

// Ortak yazı stilleri: küçük monospace etiket (büyük harf metni ekranda toLocaleUpperCase('tr-TR') ile yazılır)
// ve açıklama metni. Ekranlar bunları kendi StyleSheet'lerine yaymadan doğrudan kullanır.
export const textStyles = {
  label: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '500', letterSpacing: 0.8, color: colors.muted },
  aciklama: { fontFamily: fonts.metin, fontSize: 14, lineHeight: 20, color: colors.muted },
  baslik: { fontFamily: fonts.metin, fontSize: 17, fontWeight: '600', color: colors.text },
};
