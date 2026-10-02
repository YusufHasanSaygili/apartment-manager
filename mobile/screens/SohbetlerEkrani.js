// Sohbetler ekranı (yönetici): sitedeki sakinleri, her biriyle son mesajla birlikte listeler.
// Son yazışılan sakin en üstte; hiç yazışılmamış sakinler altta, daire adına göre sıralı.
// Bir sakine dokununca o sakinle sohbet ekranı açılır. Yeni mesaj gelince liste kendiliğinden güncellenir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useSoketOlayi } from '../services/soket';
import HataMesaji from '../components/HataMesaji';
import { tarihBicimi } from '../bicim';
import { renkler } from '../tema';

// navigation: bir sakine dokununca Sohbet ekranını açmak için kullanılır.
export default function SohbetlerEkrani({ navigation }) {
  // useState: sunucudan gelen sohbet listesi. null → henüz yüklenmedi.
  const [sohbetler, setSohbetler] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');
  // useState: listeyi aşağı çekip yenilerken true (üstte dönen simge görünür).
  const [yenileniyor, setYenileniyor] = useState(false);

  // API isteği: GET /api/mesajlar/sohbetler ile sakinleri ve her biriyle son mesajı çeker.
  // useCallback: fonksiyon her çizimde yeniden oluşmaz; useFocusEffect onu bağımlılık olarak kullandığı için
  // aksi halde ekran her yenilendiğinde istek tekrar atılırdı.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/mesajlar/sohbetler');
      setSohbetler(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde çalışır; bir sohbetten geri dönünce son mesaj güncellenir.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle])
  );

  // Soket olayları: herhangi bir sakinden yeni mesaj gelince (veya ben gönderince) ya da bağlantı
  // yeniden kurulunca liste yeniden çekilir; böylece son mesaj ve sıralama sayfa yenilemeden güncellenir.
  // navigation.isFocused(): ekran şu an görünüyor mu. Sohbet ekranı açıkken bu liste arkada bekler;
  // o sırada gelen mesajlar için boşuna istek atılmaz, geri dönünce useFocusEffect zaten yeniler.
  // useCallback: dinleyici her çizimde silinip yeniden eklenmesin diye fonksiyon sabit tutulur;
  // sadece navigation veya yukle değişirse yeniden oluşturulur.
  const gorunurkenYukle = useCallback(() => {
    if (navigation.isFocused()) yukle();
  }, [navigation, yukle]);
  useSoketOlayi('yeniMesaj', gorunurkenYukle);
  useSoketOlayi('connect', gorunurkenYukle);

  // Listeyi aşağı çekince çalışır: yenileme simgesini gösterir, listeyi yeniden çeker, simgeyi kapatır.
  const yenile = async () => {
    setYenileniyor(true);
    await yukle();
    setYenileniyor(false);
  };

  return (
    // FlatList: sakinleri listeler. onRefresh + refreshing: aşağı çekip yenileme özelliğini açar.
    // ListEmptyComponent "sohbetler &&": yüklenirken değil, boş liste gelince "Henüz sakin yok" çıkar.
    <FlatList
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={sohbetler ?? []}
      keyExtractor={(s) => s.id}
      onRefresh={yenile}
      refreshing={yenileniyor}
      ListHeaderComponent={
        <>
          {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve liste yeniden istenir */}
          {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
          {sohbetler === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
        </>
      }
      ListEmptyComponent={
        sohbetler && (
          <Text style={styles.bos}>Henüz kayıtlı sakin yok. Sakinler davet koduyla katıldıkça burada görünür.</Text>
        )
      }
      renderItem={({ item: s }) => (
        // Sohbet satırı: basınca Sohbet ekranı bu sakinin kimliği ve adıyla açılır.
        <Pressable
          style={({ pressed }) => [styles.satir, pressed && styles.basili]}
          onPress={() => navigation.navigate('Sohbet', { kisiId: s.id, baslik: `${s.ad} (${s.altBaslik})` })}
          accessibilityRole="button"
          accessibilityHint={`${s.ad} ile sohbeti açar`}
        >
          {/* Daire rozeti: sakinin dairesi (örn. "A5") */}
          <View style={styles.rozet}>
            <Text style={styles.rozetYazi}>{s.altBaslik}</Text>
          </View>
          <View style={styles.orta}>
            <View style={styles.ustSatir}>
              <Text style={styles.ad} numberOfLines={1}>
                {s.ad}
              </Text>
              {s.sonMesaj && <Text style={styles.tarih}>{tarihBicimi(s.sonMesaj.tarih)}</Text>}
            </View>
            {/* Son mesajın tek satırlık önizlemesi; benim yazdığım mesajın başında "Siz:" yazar */}
            <Text style={styles.onizleme} numberOfLines={1}>
              {s.sonMesaj ? `${s.sonMesaj.benden ? 'Siz: ' : ''}${s.sonMesaj.icerik}` : 'Henüz mesaj yok'}
            </Text>
          </View>
        </Pressable>
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
    gap: 8,
  },
  bos: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 15,
    color: renkler.soluk,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  basili: {
    opacity: 0.7,
  },
  rozet: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.arkaPlan,
  },
  rozetYazi: {
    fontSize: 15,
    fontWeight: '700',
    color: renkler.birincil,
  },
  orta: {
    flex: 1,
    gap: 2,
  },
  ustSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ad: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: renkler.yazi,
  },
  tarih: {
    fontSize: 12,
    color: renkler.soluk,
  },
  onizleme: {
    fontSize: 14,
    color: renkler.soluk,
  },
});
