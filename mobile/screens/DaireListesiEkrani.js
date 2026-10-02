// Daire listesi ekranı: yönetici sitedeki tüm daireleri bina bina görür.
// Bir daireye dokununca o dairenin davet kodu ve paylaşma butonu açılır.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

// navigation: daire koduna dokununca DaireKodu ekranını açmak için kullanılır.
export default function DaireListesiEkrani({ navigation }) {
  // useState: sunucudan gelen binalar ve içlerindeki daireler. null → henüz yüklenmedi.
  const [binalar, setBinalar] = useState(null);

  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/daireler ile sitenin binalarını ve dairelerini (kodlarıyla) çeker.
  // useCallback: fonksiyonu her çizimde yeniden oluşturmaz; böylece useEffect gereksiz yere tekrar çalışmaz.
  const listeyiYukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/daireler');
      setBinalar(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useEffect: ekran ilk açıldığında bir kez çalışır ve listeyi yükler.
  useEffect(() => {
    listeyiYukle();
  }, [listeyiYukle]);

  // Hata varsa ortak hata kutusu; "Tekrar dene" listeyiYukle'yi yeniden çalıştırır.
  if (hata !== '') {
    return (
      <View style={styles.orta}>
        <HataMesaji mesaj={hata} tekrarDene={listeyiYukle} />
      </View>
    );
  }

  // Liste gelene kadar yükleniyor simgesi gösterilir.
  if (binalar === null) {
    return (
      <View style={styles.orta}>
        <ActivityIndicator size="large" color={renkler.birincil} />
      </View>
    );
  }

  return (
    // FlatList: sadece ekranda görünen binaları çizer; çok binalı sitelerde de liste akıcı kalır.
    // keyExtractor: React'in her binayı ayırt etmesi için benzersiz anahtar (bina id'si).
    <FlatList
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={binalar}
      keyExtractor={(bina) => bina.id}
      // ListEmptyComponent: hiç bina yoksa gösterilir. ListHeaderComponent: listenin üstündeki renk açıklaması.
      ListEmptyComponent={<Text style={styles.bos}>Henüz daire oluşturulmamış.</Text>}
      ListHeaderComponent={<Text style={styles.not}>Yeşil: sakin katılmış · Gri: henüz katılmamış</Text>}
      renderItem={({ item: bina }) => (
        <View style={styles.bina}>
          <Text style={styles.binaBaslik}>{bina.ad} Blok</Text>
          <View style={styles.izgara}>
            {bina.daireler.map((daire) => {
              const daireAdi = `${bina.ad}${daire.daireNo}`;
              return (
                // Daire kutucuğu: basınca DaireKodu ekranı açılır, daire adı ve kodu oraya gönderilir.
                <Pressable
                  key={daire.id}
                  // dolu: sakin katılmış daireler koyu yeşil, katılmamışlar gri gösterilir.
                  style={({ pressed }) => [styles.daire, daire.dolu && styles.dolu, pressed && styles.basili]}
                  onPress={() =>
                    navigation.navigate('DaireKodu', { daireAdi, davetKodu: daire.davetKodu, dolu: daire.dolu })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Daire ${daireAdi}${daire.dolu ? ', sakin katılmış' : ''}, davet kodunu göster`}
                >
                  <Text style={[styles.daireYazi, daire.dolu && styles.doluYazi]}>{daireAdi}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
    padding: 16,
    gap: 16,
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
    fontSize: 15,
    color: renkler.soluk,
  },
  bina: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  binaBaslik: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  // flexWrap: kutucuklar yan yana dizilir, satır dolunca alt satıra geçer.
  izgara: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // 64x48: parmakla rahat basılabilecek boyut.
  daire: {
    minWidth: 64,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: renkler.gri,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.gri,
  },
  dolu: {
    borderColor: renkler.basarili,
    backgroundColor: renkler.basarili,
  },
  doluYazi: {
    color: renkler.birincilUzeri,
  },
  not: {
    fontSize: 14,
    color: renkler.soluk,
  },
  basili: {
    opacity: 0.6,
  },
  daireYazi: {
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
});
