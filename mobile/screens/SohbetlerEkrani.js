// Sohbetler ekranı (yönetici): sitedeki sakinleri, her biriyle son mesajla ve okunmamış mesaj sayısıyla listeler.
// Son yazışılan sakin en üstte; hiç yazışılmamış sakinler altta, daire adına göre sıralı.
// Bir sakine dokununca o sakinle sohbet ekranı açılır. Yeni mesaj gelince liste kendiliğinden güncellenir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useSoketOlayi } from '../services/soket';
import HataMesaji from '../components/HataMesaji';
import { goreliGun, saatBicimi } from '../bicim';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

// Listede son mesajın zamanı: bugünse saat ("21:11"), değilse "Dün" / "3 gün önce"
const kisaZaman = (tarih) => (goreliGun(tarih) === 'Bugün' ? saatBicimi(tarih) : goreliGun(tarih));

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

  // Okunmamış mesajı olan sohbetler üstte ayrı bölümde, diğer sakinler altta. Toplam okunmamış sayısı özet kartında.
  const okunmamislar = (sohbetler ?? []).filter((x) => x.okunmamis > 0);
  const digerleri = (sohbetler ?? []).filter((x) => x.okunmamis === 0);
  const toplam = okunmamislar.reduce((t, x) => t + x.okunmamis, 0);
  const bolumler = [
    { baslik: 'OKUNMAMIŞ', data: okunmamislar },
    { baslik: 'DİĞER SAKİNLER', data: digerleri },
  ].filter((b) => b.data.length > 0);

  return (
    // SectionList: bölümlü liste (Okunmamış / Diğer sakinler). Aşağı çekince yenile çalışır.
    <SectionList
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      sections={bolumler}
      keyExtractor={(x) => x.id}
      onRefresh={yenile}
      refreshing={yenileniyor}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <>
          {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve liste yeniden istenir */}
          {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
          {sohbetler === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
          {/* Özet kartı: toplam okunmamış mesaj ve kaç sohbette olduğu */}
          {sohbetler && sohbetler.length > 0 && (
            <View style={styles.ozet}>
              <Text style={styles.ozetSayi}>{toplam}</Text>
              <Text style={yazilar.aciklama}>{toplam > 0 ? `okunmamış mesaj\n${okunmamislar.length} sohbette` : 'Okunmamış mesaj yok'}</Text>
            </View>
          )}
        </>
      }
      renderSectionHeader={({ section }) => <Text style={[yazilar.etiket, styles.bolum]}>{section.baslik}</Text>}
      ListEmptyComponent={
        sohbetler && (
          <Text style={styles.bos}>Henüz kayıtlı sakin yok. Sakinler davet koduyla katıldıkça burada görünür.</Text>
        )
      }
      renderItem={({ item: x }) => {
        const okunmamis = x.okunmamis > 0;
        const mesajYok = !x.sonMesaj;
        return (
          // Satıra basınca o sakinle Sohbet ekranı açılır; başlıkta sakinin adı ve dairesi görünür.
          <Pressable
            style={({ pressed }) => [styles.satir, okunmamis && styles.satirOkunmamis, mesajYok && styles.satirBos, pressed && styles.basili]}
            onPress={() => navigation.navigate('Sohbet', { kisiId: x.id, baslik: `${x.ad} (${x.altBaslik})` })}
            accessibilityRole="button"
            accessibilityHint={`${x.ad} ile sohbeti açar`}
          >
            {/* Daire rozeti (örn. "A5"); köşedeki nokta: sarı = okunmamış mesaj var, yeşil = hepsi okundu */}
            <View style={[styles.avatar, mesajYok && styles.avatarBos]}>
              <Text style={[styles.avatarYazi, mesajYok && { color: renkler.soluk }]}>{x.altBaslik}</Text>
              {!mesajYok && <View style={[styles.nokta, { backgroundColor: okunmamis ? renkler.uyari : renkler.basarili }]} />}
            </View>
            <View style={styles.orta}>
              <View style={styles.ustSatir}>
                <Text style={[styles.ad, mesajYok && styles.adBos]} numberOfLines={1}>
                  {x.ad}
                </Text>
                {x.sonMesaj && <Text style={styles.tarih}>{kisaZaman(x.sonMesaj.tarih)}</Text>}
              </View>
              {/* Son mesajın tek satırlık önizlemesi; benim yazdığım mesajın başında "Siz:" yazar (okundu bilgisi listede gelmediği için tik gösterilmez) */}
              <View style={styles.ustSatir}>
                <Text style={[styles.onizleme, okunmamis && styles.okunmamisYazi, mesajYok && styles.onizlemeBos]} numberOfLines={1}>
                  {x.sonMesaj ? `${x.sonMesaj.benden ? 'Siz: ' : ''}${x.sonMesaj.icerik}` : 'Henüz mesaj yok'}
                </Text>
                {/* Okunmamış sayısı: gri kare içinde beyaz sayı (0 ise gösterilmez) */}
                {okunmamis && (
                  <View style={styles.sayac} accessibilityLabel={`${x.okunmamis} okunmamış mesaj`}>
                    <Text style={styles.sayacYazi}>{x.okunmamis}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
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
    gap: 6,
  },
  bos: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
  ozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  ozetSayi: {
    fontFamily: yaziTipi.mono,
    fontSize: 34,
    fontWeight: '600',
    color: renkler.birincil,
  },
  bolum: {
    marginTop: 10,
    marginBottom: 4,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: kose,
    backgroundColor: renkler.kart,
  },
  satirOkunmamis: {
    backgroundColor: renkler.yuzey2,
  },
  satirBos: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
  },
  basili: {
    opacity: 0.7,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBos: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: renkler.kenarlik,
  },
  avatarYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 14,
    fontWeight: '600',
    color: renkler.yazi,
  },
  // Okunma noktası: avatarın sağ alt köşesinde, zemin renginde halkayla
  nokta: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: renkler.arkaPlan,
  },
  orta: {
    flex: 1,
    gap: 2,
  },
  ustSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ad: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  adBos: {
    fontWeight: '500',
    color: renkler.soluk,
  },
  tarih: {
    fontFamily: yaziTipi.mono,
    fontSize: 11.5,
    color: renkler.soluk,
  },
  onizleme: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 13.5,
    color: renkler.soluk,
  },
  onizlemeBos: {
    fontSize: 12.5,
    color: renkler.sonuk,
  },
  okunmamisYazi: {
    color: renkler.yazi,
  },
  sayac: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: kose,
    backgroundColor: '#3B4943',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayacYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
