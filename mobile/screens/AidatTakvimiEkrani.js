// Aidat takvimi ekranı: bir dairenin seçilen yıldaki 12 ayının aidat durumunu gösterir.
// Yönetici ve sakin aynı ekranı kullanır:
//  - Yönetici (haritadan bir daireye dokununca açılır, route.params.daireId dolu): ödenmemiş bir aya
//    dokunarak o ayı elle "ödendi" işaretleyebilir (gelecek aylar dahil).
//  - Sakin (ana ekrandaki "Aidat takvimim" butonu, daireId yok): kendi dairesinin takvimini sadece görür.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';
import { AY_ADLARI } from '../bicim';
import { renkler } from '../tema';

// Ay kutucuğu renkleri ve işaretleri (haritadakiyle aynı anlam). Gelecek aylar da ödenmediyse kırmızıdır.
const DURUMLAR = {
  odendi: { zemin: renkler.basarili, yazi: renkler.birincilUzeri, isaret: '✓ Ödendi' },
  bekliyor: { zemin: renkler.sari, yazi: renkler.sariUzeri, isaret: '… Bekliyor' },
  odenmedi: { zemin: renkler.hata, yazi: renkler.birincilUzeri, isaret: '✕ Ödenmedi' },
  // O ay dairede sakin yoktu (sakin daha sonra katıldı veya hiç sakin yok): borç sayılmaz.
  bos: { zemin: renkler.gri, yazi: renkler.soluk, isaret: '– Sakin yok' },
};

// route.params: yönetici açtıysa { daireId, daireAdi } (haritadan gelir); sakin açtıysa boş.
export default function AidatTakvimiEkrani({ route }) {
  // daireId varsa ekranı yönetici açmıştır (haritadan); yoksa sakin kendi takvimine bakıyordur.
  const daireId = route.params?.daireId;
  const yonetici = Boolean(daireId);

  const bugun = new Date();
  const buYil = bugun.getFullYear();

  // useState: gösterilen yıl (varsayılan: bu yıl). Değişince takvim yeniden çekilir.
  const [yil, setYil] = useState(buYil);
  // useState: sunucudan gelen 12 ay [{ ay, durum, tutar, odemeYontemi }]. null → yükleniyor.
  const [aylar, setAylar] = useState(null);
  // useState: yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // useRef: sonIstek; değişince ekranı yeniden çizdirmeyen sayaç. Yıllar arasında hızlı geçilirse eski yılın geç gelen cevabını yok saymak için sayaç.
  const sonIstek = useRef(0);

  // API isteği: yönetici için GET /api/yonetim/aidatlar/takvim/:daireId, sakin için
  // GET /api/aidatlar/takvim (backend sakinin dairesini token'dan bulur). params: ?yil=2026
  const yukle = useCallback(async () => {
    const no = ++sonIstek.current;
    setHata('');
    setAylar(null);
    try {
      const adres = yonetici ? `/yonetim/aidatlar/takvim/${daireId}` : '/aidatlar/takvim';
      const { data } = await api.get(adres, { params: { yil } });
      if (no === sonIstek.current) setAylar(data.aylar);
    } catch (e) {
      if (no === sonIstek.current) setHata(e.message);
    }
  }, [yonetici, daireId, yil]);

  // useEffect: ekran açılınca ve yıl her değiştiğinde çalışır.
  useEffect(() => {
    yukle();
  }, [yukle]);

  // Yönetici ödeme kaydı olmayan bir aya (kırmızı "Ödenmedi" veya gri "Sakin yok") dokununca: önce onay sorulur, onaylanırsa
  // POST /api/yonetim/aidatlar/elle ile o ay "ödendi" işaretlenir ve takvim yenilenir.
  const elleIsaretle = (ay) =>
    Alert.alert(
      'Ödendi olarak işaretle',
      `${route.params.daireAdi} dairesinin ${AY_ADLARI[ay - 1]} ${yil} aidatı ödendi olarak işaretlensin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İşaretle',
          onPress: async () => {
            try {
              await api.post('/yonetim/aidatlar/elle', { daireId, ay, yil });
              yukle();
            } catch (e) {
              Alert.alert('İşaretlenemedi', e.message);
            }
          },
        },
      ]
    );

  // Yıl seçici sınırı: en fazla gelecek yıl. Yönetici ileri ayları işaretleyebilsin, sakin de
  // yöneticinin gelecek yıla işaretlediği ayları kendi takviminde görebilsin diye.
  const enSonYil = buYil + 1;
  // Geriye en fazla 5 yıl gidilebilir (çok eski yıllarda zaten kayıt olmaz).
  const enEskiYil = buYil - 5;

  return (
    <ScrollView style={styles.dis} contentContainerStyle={styles.icerik}>
      <View style={styles.yilSecici}>
        {/* "‹" butonu: basınca bir önceki yıla geçilir ve takvim yeniden yüklenir */}
        <Pressable
          style={({ pressed }) => [styles.ok, yil <= enEskiYil && styles.pasif, pressed && styles.basili]}
          onPress={() => setYil((y) => y - 1)}
          disabled={yil <= enEskiYil}
          accessibilityRole="button"
          accessibilityLabel="Önceki yıl"
        >
          <Text style={styles.okYazi}>‹</Text>
        </Pressable>
        <Text style={styles.yil}>{yil}</Text>
        {/* "›" butonu: bir sonraki yıla geçer; sınıra gelince pasiftir */}
        <Pressable
          style={({ pressed }) => [styles.ok, yil >= enSonYil && styles.pasif, pressed && styles.basili]}
          onPress={() => setYil((y) => y + 1)}
          disabled={yil >= enSonYil}
          accessibilityRole="button"
          accessibilityLabel="Sonraki yıl"
        >
          <Text style={styles.okYazi}>›</Text>
        </Pressable>
      </View>

      {yonetici && (
        <Text style={styles.not}>Ödenmemiş bir aya dokunarak o ayı elle "ödendi" işaretleyebilirsiniz.</Text>
      )}

      {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve takvim yeniden istenir */}
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {aylar === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}

      {aylar !== null && (
        <View style={styles.izgara}>
          {aylar.map((a) => {
            const d = DURUMLAR[a.durum];
            // Yönetici sadece ödeme kaydı olmayan aya (kırmızı veya gri) dokunup elle işaretleyebilir.
            const dokunulur = yonetici && (a.durum === 'odenmedi' || a.durum === 'bos');
            return (
              // Ay kutucuğu: rengi o ayın durumunu gösterir. Yönetici için kırmızı ve gri aylar dokunulabilir;
              // basınca elleIsaretle çalışır. Gri de dahil: sakin geç kayıt olduysa önceki ayı elden ödemiş olabilir.
              <Pressable
                key={a.ay}
                style={({ pressed }) => [styles.ay, { backgroundColor: d.zemin }, pressed && styles.basili]}
                disabled={!dokunulur}
                onPress={() => elleIsaretle(a.ay)}
                accessibilityRole={dokunulur ? 'button' : undefined}
                accessibilityLabel={`${AY_ADLARI[a.ay - 1]}: ${d.isaret}`}
              >
                <Text style={[styles.ayAdi, { color: d.yazi }]}>{AY_ADLARI[a.ay - 1]}</Text>
                <Text style={[styles.ayDurum, { color: d.yazi }]}>{d.isaret}</Text>
                {a.odemeYontemi === 'yonetici' && (
                  <Text style={[styles.ayNot, { color: d.yazi }]}>Yönetici işaretledi</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
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
  yilSecici: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  // 48x48: parmakla rahat basılabilecek ok düğmesi.
  ok: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okYazi: {
    fontSize: 28,
    color: renkler.birincil,
  },
  pasif: {
    opacity: 0.25,
  },
  basili: {
    opacity: 0.6,
  },
  yil: {
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  not: {
    fontSize: 14,
    color: renkler.soluk,
  },
  // 3 sütunlu ızgara: her ay kutusu satırın yaklaşık üçte biri (31%) genişliğinde.
  izgara: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  ay: {
    width: '31%',
    minHeight: 84,
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ayAdi: {
    fontSize: 15,
    fontWeight: '700',
  },
  ayDurum: {
    fontSize: 12,
    fontWeight: '600',
  },
  ayNot: {
    fontSize: 10,
    textAlign: 'center',
  },
});
