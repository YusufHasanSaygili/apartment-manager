// Sakin ana ekranı: davet koduyla katılan sakin giriş yapınca bu ekranı görür.
// Site ve daire bilgisini, "Aidat bildirimi gönder" butonunu ve gönderdiği son 2 bildirimi
// (durumlarıyla) gösterir; tüm aylar "Aidat takvimim" ekranındadır. "Duyurular" butonuyla sitenin
// duyuru listesine, "Yöneticiye mesaj" butonuyla yöneticiyle sohbete geçilir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import CikisButonu from '../components/CikisButonu';
import HataMesaji from '../components/HataMesaji';
import { ayAdi, paraBicimi } from '../bicim';
import { renkler } from '../tema';

// Bildirim durumlarının ekranda görünen adı ve rengi.
const DURUMLAR = {
  bekliyor: { yazi: 'Onay bekliyor', renk: renkler.uyari },
  onaylandi: { yazi: 'Ödendi', renk: renkler.basarili },
  reddedildi: { yazi: 'Reddedildi', renk: renkler.hata },
};

// Ödeme yöntemlerinin ekranda görünen adı. (Yöneticinin elle işaretlediği kayıtlar bu listeye
// gelmez; onlar "Aidat takvimim" ekranında "Yönetici işaretledi" olarak görünür.)
const YONTEMLER = { banka: 'Banka havalesi', elden: 'Elden' };

// navigation: aidat bildirimi ve aidat takvimi ekranlarını açmak için kullanılır.
export default function SakinAnaEkrani({ navigation }) {
  // Oturumdaki kullanıcı, site ve daire bilgisi (giriş/katılma sırasında sunucudan geldi).
  // App.js bu ekranı sadece rolü 'sakin' olan oturumlarda gösterir.
  const { oturum } = useOturum();

  // useState: sunucudan gelen { aidatTutari, bildirimler }. null → henüz yüklenmedi.
  const [veri, setVeri] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/aidatlar/benim ile sitenin aidat tutarını ve kendi dairemin son 2 bildirimini çeker.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/aidatlar/benim');
      setVeri(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde çalışır; bildirim gönderip geri dönünce
  // yeni bildirim listede kendiliğinden görünür.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle])
  );

  // Listenin üst kısmı: karşılama, daire bilgisi, bildirim butonu ve liste başlığı.
  const ust = (
    <View style={styles.ust}>
      <Text style={styles.selam}>Hoş geldin, {oturum.kullanici.ad}</Text>
      <Text style={styles.site}>{oturum.site.ad}</Text>

      <View style={styles.kart}>
        <Text style={styles.kartEtiket}>Daireniz</Text>
        {/* daire null olabilir (örn. sakin daireden çıkarıldıysa); o durumda çizgi gösterilir */}
        <Text style={styles.daire}>{oturum.daire?.ad ?? '—'}</Text>
      </View>

      {/* "Aidat bildirimi gönder" butonu: basınca AidatBildir ekranı açılır; yöneticinin
          belirlediği tutar da gönderilir ki formda hazır gelsin */}
      <Buton
        baslik="Aidat bildirimi gönder"
        onPress={() => navigation.navigate('AidatBildir', { aidatTutari: veri?.aidatTutari })}
      />
      {/* "Aidat takvimim" butonu: basınca AidatTakvimi ekranı açılır (sakin kendi dairesinin takvimini görür) */}
      <Buton baslik="Aidat takvimim" tur="ikincil" onPress={() => navigation.navigate('AidatTakvimi')} />
      {/* "Duyurular" butonu: basınca sitenin duyuru listesi açılır */}
      <Buton baslik="Duyurular" tur="ikincil" onPress={() => navigation.navigate('Duyurular')} />
      {/* "Yöneticiye mesaj" butonu: basınca Sohbet ekranı açılır; sakin sadece sitenin yöneticisiyle yazışabilir */}
      <Buton baslik="Yöneticiye mesaj" tur="ikincil" onPress={() => navigation.navigate('Sohbet')} />

      <Text style={styles.listeBaslik}>Son bildirimlerim</Text>
      <Text style={styles.bos}>Tüm aylar için "Aidat takvimim" ekranına bakın.</Text>
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {veri === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
    </View>
  );

  return (
    // Ekran iki parça: üstte kayan liste (flex: 1 ile kalan alanı kaplar), altta sabit çıkış butonu.
    // Böylece çıkış butonu kaydırmaya gerek kalmadan her zaman görünür.
    <View style={styles.dis}>
      {/* FlatList: son bildirimleri listeler; üst kısım (karşılama, butonlar) listenin başına eklenir.
          keyExtractor: her bildirimin benzersiz anahtarı (id).
          ListEmptyComponent "veri &&" ile yazıldı: "Henüz bildirim yok" yazısı yüklenirken değil, veri gelince çıkar.
          renderItem: listedeki her bildirim için bir satır çizer (ay, tutar, yöntem, durum etiketi). */}
      <FlatList
        style={styles.liste}
        contentContainerStyle={styles.icerik}
        data={veri?.bildirimler ?? []}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={ust}
        ListEmptyComponent={veri && <Text style={styles.bos}>Henüz bildirim göndermediniz.</Text>}
        renderItem={({ item: b }) => {
          const durum = DURUMLAR[b.durum];
          const reddedildi = b.durum === 'reddedildi';
          return (
            // Sadece reddedilen bildirime dokunulabilir: basınca AidatBildir ekranı o ay seçili açılır,
            // sakin aynı ay için yeniden bildirim gönderir. Diğer bildirimler dokunmaya kapalıdır (disabled).
            <Pressable
              style={({ pressed }) => [styles.bildirim, pressed && styles.basili]}
              disabled={!reddedildi}
              onPress={() =>
                navigation.navigate('AidatBildir', { aidatTutari: veri?.aidatTutari, ay: b.ay, yil: b.yil })
              }
              accessibilityRole={reddedildi ? 'button' : undefined}
              accessibilityHint={reddedildi ? 'Bu ay için yeniden bildirim gönderir' : undefined}
            >
              <View style={styles.bildirimSol}>
                <Text style={styles.bildirimAy}>{ayAdi(b.ay, b.yil)}</Text>
                <Text style={styles.bildirimDetay}>
                  {paraBicimi(b.tutar)} · {YONTEMLER[b.odemeYontemi]}
                </Text>
                {b.aciklama !== '' && <Text style={styles.bildirimDetay}>{b.aciklama}</Text>}
                {reddedildi && <Text style={styles.tekrar}>Tekrar göndermek için dokunun ›</Text>}
              </View>
              {/* Durum etiketi: rengi duruma göre (sarı = bekliyor, yeşil = ödendi, kırmızı = reddedildi) */}
              <Text style={[styles.durum, { color: durum.renk, borderColor: durum.renk }]}>{durum.yazi}</Text>
            </Pressable>
          );
        }}
      />

      {/* Sabit alt kısım: çıkış butonu (basınca onay sorulur) */}
      <View style={styles.alt}>
        <CikisButonu />
        {/* "Hesabımı sil" bağlantısı: basınca HesapSil ekranı açılır (geri alınamaz işlem; orada şifre ve onay istenir).
            Kırmızı ve küçük yazı: ana işlem olmadığı, yanlışlıkla basılmaması için göze batmayan bir bağlantı. */}
        <Pressable style={styles.hesapSil} onPress={() => navigation.navigate('HesapSil')} hitSlop={8} accessibilityRole="button">
          <Text style={styles.hesapSilYazi}>Hesabımı sil</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 24,
    gap: 10,
  },
  ust: {
    gap: 12,
    marginBottom: 4,
  },
  selam: {
    fontSize: 16,
    color: renkler.soluk,
  },
  site: {
    fontSize: 28,
    fontWeight: '700',
    color: renkler.yazi,
  },
  kart: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  kartEtiket: {
    fontSize: 15,
    color: renkler.soluk,
  },
  daire: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: '700',
    color: renkler.birincil,
  },
  listeBaslik: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  bos: {
    fontSize: 15,
    color: renkler.soluk,
  },
  bildirim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: renkler.kart,
  },
  bildirimSol: {
    flex: 1,
    gap: 2,
  },
  bildirimAy: {
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  basili: {
    opacity: 0.7,
  },
  tekrar: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: renkler.birincil,
  },
  bildirimDetay: {
    fontSize: 14,
    color: renkler.soluk,
  },
  durum: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  liste: {
    flex: 1,
  },
  alt: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  // "Hesabımı sil" bağlantısı: çıkış butonunun altında, ortada; kırmızı yazı tehlikeli bir işlem olduğunu belli eder.
  hesapSil: {
    alignSelf: 'center',
    marginTop: 16,
  },
  hesapSilYazi: {
    fontSize: 14,
    fontWeight: '600',
    color: renkler.hata,
  },
});
