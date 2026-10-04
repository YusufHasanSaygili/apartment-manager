// "Bağlantı yok" uyarısı: sunucuya ulaşılamadığında ekranın altında, tüm ekranların üstünde küçük bir kırmızı
// şerit çıkar. Bağlantı durumu api.js'te tutulur (istek ağ hatası alınca veya soket kopunca "yok" olur).
// Şerit açıkken 5 saniyede bir sunucuya küçük bir sağlık isteği atılır; cevap gelince şerit kendiliğinden kaybolur.
import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { baglantiVarMi, baglantiyiDinle } from '../services/api';
import { useOturum } from '../services/OturumContext';
import { kose, renkler, yaziTipi } from '../tema';
import Ikon from './Ikon';

export default function BaglantiSeridi() {
  // useSyncExternalStore: React dışında (api.js'te) tutulan bağlantı durumunu okur. Durum değişince
  // api.js dinleyicileri haber verir ve şerit kendini yeniden çizer (göster/gizle).
  const baglanti = useSyncExternalStore(baglantiyiDinle, baglantiVarMi);
  // Alt gezinme çubuğunun yüksekliği: şerit çubuğun arkasında kalmasın diye o kadar yukarıda durur.
  const { bottom } = useSafeAreaInsets();
  // Açılışta sunucuya ulaşılamadıysa ekranın ortasında zaten aynı hata ve "Tekrar dene" var; şerit ikinci kez göstermez.
  const { acilisHatasi } = useOturum();

  // useEffect: bağlantı yokken 5 saniyede bir GET /api/saglik isteği atar. Sunucu cevap verirse api.js
  // durumu "var" yapar, şerit kapanır ve bu zamanlayıcı temizlenir. Hata sessizce yutulur (şerit zaten açık).
  useEffect(() => {
    if (baglanti) return;
    const zamanlayici = setInterval(() => api.get('/saglik').catch(() => {}), 5000);
    return () => clearInterval(zamanlayici);
  }, [baglanti]);

  if (baglanti || acilisHatasi) return null;
  return (
    // pointerEvents="none": şerit dokunmaları engellemez; altındaki butonlara basılabilir.
    // accessibilityLiveRegion: ekran okuyucu şerit çıkınca uyarıyı kendiliğinden okur (Android).
    <View pointerEvents="none" style={[styles.serit, { bottom: bottom + 12 }]} accessibilityLiveRegion="polite">
      <Ikon ad="uyari" boyut={16} renk={renkler.hata} arka={renkler.hataZemin} />
      <Text style={styles.yazi}>Sunucuya ulaşılamıyor. Yeniden deneniyor…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  serit: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.hataCizgi,
    backgroundColor: renkler.hataZemin,
  },
  yazi: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 13,
    fontWeight: '500',
    color: renkler.hata,
  },
});
