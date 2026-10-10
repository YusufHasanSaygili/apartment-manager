// "Bağlantı yok" uyarısı: sunucuya ulaşılamadığında ekranın altında, tüm ekranların üstünde küçük bir kırmızı
// şerit çıkar. Bağlantı durumu api.js'te tutulur (istek ağ hatası alınca veya soket kopunca "yok" olur).
// Şerit açıkken 5 saniyede bir sunucuya küçük bir sağlık isteği atılır; cevap gelince şerit kendiliğinden kaybolur.
import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { getIsConnected, subscribeConnection } from '../services/api';
import { useSession } from '../services/SessionContext';
import { radius, colors, fonts } from '../theme';
import Icon from './Icon';

export default function ConnectionBanner() {
  // useSyncExternalStore: React dışında (api.js'te) tutulan bağlantı durumunu okur. Durum değişince
  // api.js dinleyicileri haber verir ve şerit kendini yeniden çizer (göster/gizle).
  const connected = useSyncExternalStore(subscribeConnection, getIsConnected);
  // Alt gezinme çubuğunun yüksekliği: şerit çubuğun arkasında kalmasın diye o kadar yukarıda durur.
  const { bottom } = useSafeAreaInsets();
  // Açılışta sunucuya ulaşılamadıysa ekranın ortasında zaten aynı hata ve "Tekrar dene" var; şerit ikinci kez göstermez.
  const { startupError } = useSession();

  // useEffect: bağlantı yokken 5 saniyede bir GET /api/health isteği atar. Sunucu cevap verirse api.js
  // durumu "var" yapar, şerit kapanır ve bu zamanlayıcı temizlenir. Hata sessizce yutulur (şerit zaten açık).
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => api.get('/health').catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [connected]);

  if (connected || startupError) return null;
  return (
    // pointerEvents="none": şerit dokunmaları engellemez; altındaki butonlara basılabilir.
    // accessibilityLiveRegion: ekran okuyucu şerit çıkınca uyarıyı kendiliğinden okur (Android).
    <View pointerEvents="none" style={[styles.banner, { bottom: bottom + 12 }]} accessibilityLiveRegion="polite">
      <Icon name="warning" size={16} color={colors.error} background={colors.errorBackground} />
      <Text style={styles.text}>Sunucuya ulaşılamıyor. Yeniden deneniyor…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBackground,
  },
  text: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 13,
    fontWeight: '500',
    color: colors.error,
  },
});
