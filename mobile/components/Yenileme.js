// Aşağı çekip yenileme: liste veya sayfa en üstteyken aşağı çekilince ekranın verisi sunucudan yeniden istenir.
// Listeli ekranların hepsi aynı görünüm ve davranışı kullansın diye tek yerde tanımlandı.
// Kullanım: const yenileme = useYenileme(yukle);  →  <FlatList refreshControl={yenileme} ... />
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { renkler } from '../tema';

// yukle: ekranın veriyi çeken fonksiyonu (Promise döndürmeli; bitince dönen simge kapanır).
export function useYenileme(yukle) {
  // useState: yenileme sürüyor mu. true iken listenin üstünde dönen simge görünür.
  const [yenileniyor, setYenileniyor] = useState(false);

  // Aşağı çekince çalışır: simgeyi açar, veriyi yeniden çeker, simgeyi kapatır.
  // Hata mesajını ekranın kendi yukle fonksiyonu gösterir; finally sayesinde hata olsa bile simge takılı kalmaz.
  const yenile = async () => {
    setYenileniyor(true);
    try {
      await yukle();
    } finally {
      setYenileniyor(false);
    }
  };

  // RefreshControl: React Native'in hazır yenileme simgesi. colors / progressBackgroundColor: Android'de
  // simge altın renkte, koyu kart zemininde döner (temaya uysun diye).
  return (
    <RefreshControl
      refreshing={yenileniyor}
      onRefresh={yenile}
      colors={[renkler.birincil]}
      tintColor={renkler.birincil}
      progressBackgroundColor={renkler.kart}
    />
  );
}
