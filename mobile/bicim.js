// Ortak biçimlendirme yardımcıları: ay adları, para tutarları ve tarihler her ekranda aynı görünsün diye.

export const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// ay 1–12 → "Ekim 2026"
export const ayAdi = (ay, yil) => `${AY_ADLARI[ay - 1]} ${yil}`;

// Para biçimlendirici bir kez oluşturulur ve tekrar kullanılır (her çağrıda yeniden oluşturmak yavaştır).
// tr-TR: Türkçe biçim → 1500.5 sayısı "₺1.500,50" olarak gösterilir.
const paraBicimlendirici = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const paraBicimi = (tutar) => paraBicimlendirici.format(tutar);

// Tarih biçimlendirici (bir kez oluşturulur): sunucudan gelen tarih → "2 Eki 2026 19:57"
const tarihBicimlendirici = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
export const tarihBicimi = (tarih) => tarihBicimlendirici.format(new Date(tarih));

// Kullanıcının yazdığı Türkçe tutar metnini sayıya çevirir: "1.500,50" → 1500.5
// Binlik ayıracı noktalar silinir, ondalık virgülü noktaya çevrilir. Geçersizse NaN döner.
export const tutarOku = (metin) => Number(metin.replace(/\./g, '').replace(',', '.'));

// Tutar kutusuna yazılırken sadece rakam ve TEK virgül kalır, virgülden sonra en fazla 2 hane.
// Birçok Android klavyesinde ondalık tuşu nokta olduğu için nokta da virgüle çevrilir
// ("750.5" → "750,5"); yoksa nokta silinir ve tutar 10 kat büyük olurdu ("7505").
export const tutarTemizle = (metin) => {
  const [tam, ...kalan] = metin.replace(/\./g, ',').replace(/[^\d,]/g, '').split(',');
  return kalan.length ? `${tam},${kalan.join('').slice(0, 2)}` : tam;
};

// Sayıyı kutuda gösterilecek Türkçe metne çevirir: 750 → "750", 750.5 → "750,50"
export const tutarMetni = (tutar) =>
  tutar == null ? '' : Number.isInteger(tutar) ? String(tutar) : tutar.toFixed(2).replace('.', ',');
