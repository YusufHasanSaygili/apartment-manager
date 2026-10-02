// Uygulamanın ayar dosyası: backend adresi SADECE buradan okunur.
// Adres koda gömülmez; mobile/.env dosyasındaki EXPO_PUBLIC_API_URL değerinden gelir.
// Bilgisayarın yerel IP'si değişince veya sunucu taşınınca sadece .env güncellenir.
// (EXPO_PUBLIC_ ile başlayan değişkenleri Expo uygulamaya kendisi ekler, ek kütüphane gerekmez.)
export const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Adres tanımlı değilse geliştiriciyi uyarır; aksi halde istekler "undefined/api"ye gider
// ve hatanın nedeni anlaşılmaz.
if (!API_URL) {
  console.warn('EXPO_PUBLIC_API_URL tanımlı değil: mobile/.env dosyasını oluşturup Expo\'yu "npx expo start -c" ile yeniden başlatın.');
}
