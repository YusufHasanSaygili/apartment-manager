// Daire listesi ekranı (yönetici): tüm daireleri bina bina, 4'lü hizalı kutularda gösterir.
// Sakini katılmış daireler yeşil tonlu, henüz katılmamış daireler çizgili gri. Bir daireye dokununca
// o dairenin davet kodu alttan açılan pencerede (DaireKodu) gösterilir; oradan paylaşılabilir veya sakin çıkarılabilir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';
import { useYenileme } from '../components/Yenileme';
import { BinaKarti, Lejant } from '../components/Durum';
import { renkler, yaziTipi } from '../tema';

// navigation: daireye dokununca DaireKodu penceresini açmak için kullanılır.
export default function DaireListesiEkrani({ navigation }) {
  // useState: sunucudan gelen binalar ve daireleri. null → henüz yüklenmedi.
  const [binalar, setBinalar] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/daireler → binalar, her binanın daireleri, davet kodları ve dairedeki sakin.
  // useCallback: fonksiyon her çizimde yeniden oluşmasın; useFocusEffect/useEffect buna bağlı olduğu için istek gereksiz yere tekrar atılmaz.
  const listeyiYukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/daireler');
      setBinalar(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde liste yeniden yüklenir; sakin çıkarılıp pencere kapanınca
  // dairenin rengi (dolu → boş) hemen güncellenir.
  useFocusEffect(
    useCallback(() => {
      listeyiYukle();
    }, [listeyiYukle]),
  );

  // Aşağı çekip yenileme: sayfa en üstteyken aşağı çekilince listeyiYukle tekrar çalışır (components/Yenileme.js).
  const yenileme = useYenileme(listeyiYukle);

  if (hata !== '') {
    return (
      <View style={styles.orta}>
        {/* "Tekrar dene" butonu: basınca listeyiYukle yeniden çalışır */}
        <HataMesaji mesaj={hata} tekrarDene={listeyiYukle} />
      </View>
    );
  }

  if (binalar === null) {
    return (
      <View style={styles.orta}>
        <ActivityIndicator size="large" color={renkler.birincil} />
      </View>
    );
  }

  return (
    // FlatList: binaları alt alta listeler; her bina kendi kartında.
    <FlatList
      refreshControl={yenileme}
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={binalar}
      keyExtractor={(bina) => bina.id}
      ListEmptyComponent={<Text style={styles.bos}>Henüz daire oluşturulmamış.</Text>}
      ListHeaderComponent={<Lejant ogeler={[['dolu'], ['bosDaire']]} />}
      renderItem={({ item: bina }) => (
        // Daire kutusuna basınca DaireKodu penceresi açılır; dairenin kodu, sakini ve durumu da gönderilir
        <BinaKarti
          ad={bina.ad}
          ikonsuz
          daireler={bina.daireler.map((d) => ({
            ...d,
            ad: `${bina.ad}${d.daireNo}`,
            durum: d.dolu ? 'dolu' : 'bosDaire',
            erisimAdi: `Daire ${bina.ad}${d.daireNo}${d.dolu ? ', sakin katılmış' : ''}, davet kodunu göster`,
          }))}
          daireBasinca={(d) =>
            navigation.navigate('DaireKodu', {
              daireId: d.id,
              daireAdi: d.ad,
              davetKodu: d.davetKodu,
              dolu: d.dolu,
              sakinAdi: d.sakinAdi,
              yoneticiDairesi: d.yoneticiDairesi,
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 18,
    gap: 14,
  },
  orta: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: renkler.arkaPlan,
  },
  bos: {
    textAlign: 'center',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
});
