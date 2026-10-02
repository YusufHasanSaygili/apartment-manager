// Daire haritası ekranı: yönetici seçilen ay için tüm dairelerin aidat durumunu renkli ızgarada görür.
// Yeşil = ödedi, sarı = onay bekliyor, kırmızı = ödemedi, gri = dairede henüz sakin yok.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';
import { ayAdi } from '../bicim';
import { renkler } from '../tema';

// Her durumun kutucuk rengi, yazı rengi, işareti ve açıklaması.
// İşaret (✓ … ✕ –): renkleri ayırt edemeyen kullanıcılar da durumu anlayabilsin diye.
const DURUMLAR = {
  odendi: { zemin: renkler.basarili, yazi: renkler.birincilUzeri, isaret: '✓', ad: 'Ödedi' },
  bekliyor: { zemin: renkler.sari, yazi: renkler.sariUzeri, isaret: '…', ad: 'Bekliyor' },
  odenmedi: { zemin: renkler.hata, yazi: renkler.birincilUzeri, isaret: '✕', ad: 'Ödemedi' },
  bos: { zemin: renkler.gri, yazi: renkler.soluk, isaret: '–', ad: 'Sakin yok' },
};

// Bugünün ayı: ay seçici bundan ileriye gidemez.
const bugun = new Date();
const BU_AY = { ay: bugun.getMonth() + 1, yil: bugun.getFullYear() };

// Bir ay ileri veya geri gider: { ay: 1, yil: 2026 } ve -1 → { ay: 12, yil: 2025 }
// Hesabı Date yapar: ay 0'ın altına veya 11'in üstüne çıkınca yılı kendisi değiştirir.
function ayKaydir({ ay, yil }, fark) {
  const tarih = new Date(yil, ay - 1 + fark, 1);
  return { ay: tarih.getMonth() + 1, yil: tarih.getFullYear() };
}

export default function DaireHaritasiEkrani() {
  // useState: haritası gösterilen ay (varsayılan: bu ay). Değişince harita yeniden çekilir.
  const [secilenAy, setSecilenAy] = useState(BU_AY);
  // useState: sunucudan gelen { binalar, ozet }. null → yükleniyor.
  const [veri, setVeri] = useState(null);
  // useState: harita yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/yonetim/aidatlar/harita?ay=..&yil=.. ile seçilen ayın durumlarını çeker.
  // params: axios ay ve yılı adrese "?ay=10&yil=2026" olarak ekler.
  // sonIstek: her isteğe artan bir numara verilir. Aylar arasında hızlı geçilirse eski ayın cevabı
  // sonradan gelebilir; numarası en son istekle aynı değilse cevap yok sayılır (yanlış ay görünmez).
  // useRef: değeri değişince ekran yeniden çizilmez, sadece sayaç olarak tutulur.
  const sonIstek = useRef(0);
  const yukle = useCallback(async () => {
    const no = ++sonIstek.current;
    setHata('');
    setVeri(null);
    try {
      const { data } = await api.get('/yonetim/aidatlar/harita', { params: secilenAy });
      if (no === sonIstek.current) setVeri(data);
    } catch (e) {
      if (no === sonIstek.current) setHata(e.message);
    }
  }, [secilenAy]);

  // useEffect: ekran açılınca ve seçilen ay her değiştiğinde çalışır (bağımlılık: yukle → secilenAy).
  useEffect(() => {
    yukle();
  }, [yukle]);

  // Seçilen ay bu ay mı? Doğruysa "›" (sonraki ay) butonu pasif yapılır.
  const buAyda = secilenAy.ay === BU_AY.ay && secilenAy.yil === BU_AY.yil;

  // Ay seçici, renk açıklaması ve özet: listenin üst kısmında gösterilir.
  const ust = (
    <View style={styles.ust}>
      <View style={styles.aySecici}>
        {/* "‹" butonu: basınca bir önceki aya geçilir ve harita yeniden yüklenir */}
        <Pressable
          style={({ pressed }) => [styles.ok, pressed && styles.basili]}
          onPress={() => setSecilenAy((a) => ayKaydir(a, -1))}
          accessibilityRole="button"
          accessibilityLabel="Önceki ay"
        >
          <Text style={styles.okYazi}>‹</Text>
        </Pressable>
        <Text style={styles.ayAdi}>{ayAdi(secilenAy.ay, secilenAy.yil)}</Text>
        {/* "›" butonu: bir sonraki aya geçer; bu aydayken pasiftir (gelecek ay seçilemez) */}
        <Pressable
          style={({ pressed }) => [styles.ok, buAyda && styles.pasif, pressed && styles.basili]}
          onPress={() => setSecilenAy((a) => ayKaydir(a, 1))}
          disabled={buAyda}
          accessibilityRole="button"
          accessibilityLabel="Sonraki ay"
        >
          <Text style={styles.okYazi}>›</Text>
        </Pressable>
      </View>

      {/* Renk açıklaması ve her durumdaki daire sayısı (özet sunucudan gelir) */}
      <View style={styles.aciklamalar}>
        {Object.entries(DURUMLAR).map(([anahtar, d]) => (
          <View key={anahtar} style={styles.aciklama}>
            <View style={[styles.nokta, { backgroundColor: d.zemin }]} />
            <Text style={styles.aciklamaYazi}>
              {d.ad} {veri ? veri.ozet[anahtar] : ''}
            </Text>
          </View>
        ))}
      </View>

      {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve harita yeniden istenir */}
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {veri === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
    </View>
  );

  return (
    // FlatList: binaları alt alta listeler (her bina bir kart); üst kısım ListHeaderComponent ile eklenir.
    <FlatList
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={veri?.binalar ?? []}
      keyExtractor={(bina) => bina.id}
      ListHeaderComponent={ust}
      // veri &&: yüklenirken "daire yok" yazısı görünmesin; sadece sunucudan boş liste gelince çıksın.
      ListEmptyComponent={veri && <Text style={styles.bos}>Henüz daire oluşturulmamış.</Text>}
      renderItem={({ item: bina }) => (
        <View style={styles.bina}>
          <Text style={styles.binaBaslik}>{bina.ad} Blok</Text>
          <View style={styles.izgara}>
            {bina.daireler.map((daire) => {
              const d = DURUMLAR[daire.durum];
              return (
                // Daire kutucuğu: rengi ve işareti o ayki aidat durumunu gösterir.
                // (Dokununca açılacak aidat takvimi Görev 2.4'te eklenecek.)
                <View
                  key={daire.id}
                  style={[styles.daire, { backgroundColor: d.zemin }]}
                  accessible
                  accessibilityLabel={`Daire ${daire.ad}: ${d.ad}`}
                >
                  <Text style={[styles.daireAd, { color: d.yazi }]}>{daire.ad}</Text>
                  <Text style={[styles.isaret, { color: d.yazi }]}>{d.isaret}</Text>
                </View>
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
  ust: {
    gap: 12,
  },
  aySecici: {
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
  ayAdi: {
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  aciklamalar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  aciklama: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nokta: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  aciklamaYazi: {
    fontSize: 14,
    color: renkler.yazi,
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
  daire: {
    minWidth: 64,
    minHeight: 56,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daireAd: {
    fontSize: 16,
    fontWeight: '700',
  },
  isaret: {
    fontSize: 13,
    fontWeight: '700',
  },
});
