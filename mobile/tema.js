// Uygulamanın renk paleti: tüm ekranlar renkleri buradan alır.
// Renk tek yerden değişince bütün uygulama aynı anda güncellenir; ekranlarda
// rastgele renk kodları birikmez. (Güven veren teal + profesyonel mavi paleti.)
export const renkler = {
  birincil: '#0F766E', // ana butonlar, vurgular
  birincilUzeri: '#FFFFFF', // birincil renk üstündeki yazı
  arkaPlan: '#F0FDFA',
  kart: '#FFFFFF',
  yazi: '#134E4A', // başlıklar ve ana metin
  soluk: '#475569', // açıklama ve yardımcı metin
  kenarlik: '#CBD5E1',
  hata: '#DC2626',
  // Aidat durum renkleri: yeşil = ödendi, sarı (koyu ton, okunaklı) = onay bekliyor.
  basarili: '#15803D',
  uyari: '#B45309',
};
