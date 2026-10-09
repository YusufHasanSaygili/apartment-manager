// Aşağı çekip yenileme: liste veya sayfa en üstteyken aşağı çekilince ekranın verisi sunucudan yeniden istenir.
// Listeli ekranların hepsi aynı görünüm ve davranışı kullansın diye tek yerde tanımlandı.
// Kullanım: const refreshControl = useRefresh(load);  →  <FlatList refreshControl={refreshControl} ... />
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { colors } from '../theme';

// load: ekranın veriyi çeken fonksiyonu (Promise döndürmeli; bitince dönen simge kapanır).
export function useRefresh(load) {
  // useState: yenileme sürüyor mu. true iken listenin üstünde dönen simge görünür.
  const [refreshing, setRefreshing] = useState(false);

  // Aşağı çekince çalışır: simgeyi açar, veriyi yeniden çeker, simgeyi kapatır.
  // Hata mesajını ekranın kendi load fonksiyonu gösterir; finally sayesinde hata olsa bile simge takılı kalmaz.
  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // RefreshControl: React Native'in hazır yenileme simgesi. colors / progressBackgroundColor: Android'de
  // simge altın renkte, koyu kart zemininde döner (temaya uysun diye).
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
      colors={[colors.primary]}
      tintColor={colors.primary}
      progressBackgroundColor={colors.card}
    />
  );
}
