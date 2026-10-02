// Duyurular ekranı: sitenin duyurularını yeniden eskiye listeler. Yönetici ve sakin aynı ekranı görür.
// Yönetici ayrıca üstteki butonla yeni duyuru yazabilir; bir duyuruya dokunarak düzenleyebilir veya silebilir.
// "Tekrarlayan duyurular" butonuyla belirli gün ve saatte kendiliğinden yayınlanan duyuruları yönetir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { tarihBicimi } from '../bicim';
import { renkler } from '../tema';

// navigation: yöneticinin duyuru yazma/düzenleme ekranını açması için kullanılır.
export default function DuyurularEkrani({ navigation }) {
  // Rol oturumdan okunur: yazma/silme düğmeleri sadece yöneticiye gösterilir
  // (asıl yetki kontrolü backend'de; sakin istek atsa bile 403 alır).
  const { oturum } = useOturum();
  const yonetici = oturum.kullanici.rol === 'yonetici';

  // useState: sunucudan gelen duyurular. null → yükleniyor.
  const [duyurular, setDuyurular] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/duyurular ile kendi sitemin duyurularını çeker.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/duyurular');
      setDuyurular(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde çalışır; yönetici duyuru yazıp geri dönünce
  // yeni duyuru listede kendiliğinden görünür.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle])
  );

  // Listenin üst kısmı: yönetici için "Yeni duyuru" butonu ve ipucu, ayrıca yükleniyor/hata durumu.
  const ust = (
    <View style={styles.ust}>
      {yonetici && (
        <>
          {/* "Yeni duyuru" butonu: basınca DuyuruYaz ekranı açılır */}
          <Buton baslik="Yeni duyuru" onPress={() => navigation.navigate('DuyuruYaz')} />
          {/* "Tekrarlayan duyurular" butonu: basınca TekrarlananDuyurular ekranı açılır ("Her pazartesi çöp günü" gibi) */}
          <Buton
            baslik="Tekrarlayan duyurular"
            tur="ikincil"
            onPress={() => navigation.navigate('TekrarlananDuyurular')}
          />
          <Text style={styles.ipucu}>Düzenlemek veya silmek için bir duyuruya dokunun.</Text>
        </>
      )}
      {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve liste yeniden istenir */}
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {duyurular === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
    </View>
  );

  return (
    // FlatList: duyuruları listeler. keyExtractor: her duyurunun benzersiz anahtarı (id).
    // ListEmptyComponent "duyurular &&": yüklenirken değil, boş liste gelince "Henüz duyuru yok" çıkar.
    <FlatList
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={duyurular ?? []}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={ust}
      ListEmptyComponent={duyurular && <Text style={styles.bos}>Henüz duyuru yok.</Text>}
      renderItem={({ item: d }) => (
        // Duyuru kartı: yönetici dokununca DuyuruYaz ekranı bu duyuruyla (düzenleme modunda) açılır;
        // sakin için dokunmaya kapalıdır (disabled).
        <Pressable
          style={({ pressed }) => [styles.kart, pressed && yonetici && styles.basili]}
          onPress={() => navigation.navigate('DuyuruYaz', { duyuru: d })}
          disabled={!yonetici}
          accessibilityRole={yonetici ? 'button' : undefined}
          accessibilityHint={yonetici ? 'Duyuruyu düzenler veya siler' : undefined}
        >
          <Text style={styles.baslik}>{d.baslik}</Text>
          <Text style={styles.metin}>{d.icerik}</Text>
          <Text style={styles.tarih}>{tarihBicimi(d.tarih)}</Text>
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
    gap: 12,
  },
  ust: {
    gap: 8,
  },
  ipucu: {
    fontSize: 13,
    textAlign: 'center',
    color: renkler.soluk,
  },
  bos: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 15,
    color: renkler.soluk,
  },
  kart: {
    padding: 16,
    gap: 6,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  basili: {
    opacity: 0.7,
  },
  baslik: {
    fontSize: 17,
    fontWeight: '700',
    color: renkler.yazi,
  },
  metin: {
    fontSize: 15,
    lineHeight: 22,
    color: renkler.yazi,
  },
  tarih: {
    fontSize: 13,
    color: renkler.soluk,
  },
});
