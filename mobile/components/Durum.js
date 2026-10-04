// Aidat durumlarının ortak görünümü: daire haritası, aidat takvimi, daire listesi ve ana ekranlar bu parçaları kullanır.
// Her durumun tek bir rengi, ikonu ve adı vardır (DURUMLAR). Kutular koyu zemin üstünde o rengin ince tonuyla çizilir.
// Ödeyen kutularda soldan sağa geçen bir parlama, ödemeyen kutularda kırmızı "nefes alma" efekti oynar.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { karistir, kose, renkler, yaziTipi } from '../tema';
import Ikon from './Ikon';

// Durum kodu → renk, ikon ve ekranda görünen ad. Kodlar backend'den gelir (odendi, bekliyor, odenmedi, bos);
// gelecek, once, dolu ve bosDaire mobilde hesaplanır.
export const DURUMLAR = {
  odendi: { renk: renkler.basarili, ikon: 'odedi', ad: 'Ödedi' },
  bekliyor: { renk: renkler.uyari, ikon: 'bekliyor', ad: 'Bekliyor' },
  odenmedi: { renk: renkler.hata, ikon: 'odemedi', ad: 'Ödemedi' },
  bos: { renk: renkler.yok, ikon: 'yok', ad: 'Sakin yok' },
  gelecek: { renk: renkler.soluk, ikon: 'gelecek', ad: 'Henüz gelmedi' },
  once: { renk: renkler.yok, ikon: 'once', ad: 'Katılmadan önce' },
  dolu: { renk: renkler.basarili, ikon: 'sakin', ad: 'Sakin katılmış' },
  bosDaire: { renk: renkler.yok, ikon: 'yok', ad: 'Henüz katılmamış' },
};
// Renkli (dolgulu) çizilen durumlar; diğerleri sadece ince çerçeveli
const RENKLI = ['odendi', 'bekliyor', 'odenmedi', 'dolu'];

// Renkli kutunun zemini: yukarıda durum renginin %15'i, aşağıda %6'sı (yukarıdan aşağı koyulaşan ince ton,
// plastik düz dolgu yerine). Çerçeve durum renginin %34'ü. backgroundColor: geçiş çizilemezse kullanılan düz ton.
const renkliZemin = (renk) => ({
  backgroundColor: karistir(renk, 0.1),
  experimental_backgroundImage: `linear-gradient(180deg, ${karistir(renk, 0.15)}, ${karistir(renk, 0.06)})`,
  borderColor: karistir(renk, 0.34),
});

// Parlama: kutunun üstünden çapraz bir ışık çizgisi soldan sağa geçer (ödeyene "ödüllendirildi" hissi).
// gecikme: yan yana kutular aynı anda parlamasın diye her kutuya farklı başlangıç.
function Parlama({ gecikme = 0 }) {
  // useSharedValue: çizginin yatay konumu (0 = solda dışarıda, 1 = sağda dışarıda)
  const konum = useSharedValue(0);
  // useEffect: kutu ekrana gelince parlamayı başlatır; withRepeat ile sonsuza kadar tekrarlar (-1).
  useEffect(() => {
    konum.value = withDelay(
      gecikme,
      withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 2100 })), -1),
    );
  }, [konum, gecikme]);
  // useAnimatedStyle: konum değiştikçe çizgiyi sağa kaydırır ve çapraz durması için 25 derece eğer
  const stil = useAnimatedStyle(() => ({ transform: [{ translateX: -90 + konum.value * 220 }, { rotate: '25deg' }] }));
  return <Animated.View pointerEvents="none" style={[styles.parlama, stil]} />;
}

// Nefes: ödemeyen kutunun üstünde kırmızı katman soluk ↔ parlak arasında yavaşça gidip gelir.
function Nefes() {
  // useSharedValue: kırmızı katmanın saydamlığı. Animasyon arka planda (UI thread'de) değiştiği için
  // useState gibi ekranı yeniden çizdirmez, akıcı kalır.
  const parlaklik = useSharedValue(0.08);
  // useEffect: 1.6 sn'de parlar, 1.6 sn'de söner; sonsuz tekrar.
  useEffect(() => {
    parlaklik.value = withRepeat(withTiming(0.32, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [parlaklik]);
  const stil = useAnimatedStyle(() => ({ opacity: parlaklik.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.nefes, stil]} />;
}

// Daire kutusu (harita, daire listesi, kurulum önizlemesi): üstte daire adı, altta durum ikonu.
// onPress verilirse basılabilir olur (haritada takvime, listede davet koduna gider).
// ikonsuz: daire listesinde sadece ad gösterilir. kucuk: kurulum önizlemesindeki küçük kutular.
export function DaireKutusu({ ad, durum, onPress, ikonsuz = false, kucuk = false, sira = 0, erisimAdi }) {
  const d = DURUMLAR[durum];
  const renkli = RENKLI.includes(durum);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={erisimAdi ?? `Daire ${ad}: ${d.ad}`}
      style={({ pressed }) => [
        styles.daire,
        kucuk && styles.daireKucuk,
        renkli
          ? renkliZemin(d.renk)
          : [{ backgroundColor: renkler.kart, borderColor: renkler.kenarlik }, styles.cizgili],
        pressed && styles.basili,
      ]}
    >
      <Text style={[styles.daireAd, kucuk && styles.daireAdKucuk, !renkli && { color: renkler.sonuk }]}>{ad}</Text>
      {!ikonsuz && <Ikon ad={d.ikon} boyut={18} renk={d.renk} arka={renkler.kart} />}
      {durum === 'odendi' && <Parlama gecikme={(sira % 3) * 900} />}
      {durum === 'odenmedi' && <Nefes />}
    </Pressable>
  );
}

// "Henüz gelmedi" ikonu: dıştaki ok saat yönünde yavaşça döner (gelecek), içindeki takvim sabit kalır.
function GelecekIkonu() {
  // useSharedValue: dönen okun açısı (derece)
  const aci = useSharedValue(0);
  // useEffect: 3.5 sn bekler, 1.5 sn'de bir tur atar; sonsuz tekrar.
  useEffect(() => {
    aci.value = withRepeat(withSequence(withTiming(0, { duration: 3500 }), withTiming(360, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })), -1);
  }, [aci]);
  const stil = useAnimatedStyle(() => ({ transform: [{ rotate: `${aci.value}deg` }] }));
  return (
    <View>
      <Animated.View style={stil}>
        <Ikon ad="gelecekOk" boyut={20} renk={renkler.soluk} />
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <Ikon ad="gelecekTakvim" boyut={20} renk={renkler.soluk} />
      </View>
    </View>
  );
}

// Ay kutusu (aidat takvimi): solda ikon kutusu, sağda ay adı ve durum yazısı. Bütün kutular aynı yükseklikte.
// alt: durum yazısının yerine geçen özel yazı (örn. "Elle işaretlendi"), onPress: basınca çalışır (elle işaretleme).
export function AyKutusu({ ad, durum, alt, onPress, sira = 0 }) {
  const d = DURUMLAR[durum];
  const renkli = RENKLI.includes(durum);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${ad}: ${alt ?? d.ad}`}
      style={({ pressed }) => [
        styles.ay,
        renkli
          ? renkliZemin(d.renk)
          : { borderColor: renkler.kenarlik },
        pressed && styles.basili,
      ]}
    >
      <View style={[styles.ayIkon, { backgroundColor: karistir(d.renk, 0.12, renkli ? karistir(d.renk, 0.12) : renkler.arkaPlan) }]}>
        {durum === 'gelecek' ? <GelecekIkonu /> : <Ikon ad={d.ikon} boyut={20} renk={d.renk} />}
      </View>
      <View style={styles.ayMetin}>
        <Text style={[styles.ayAd, !renkli && { color: renkler.soluk, fontWeight: '500' }]}>{ad}</Text>
        <Text style={[styles.ayDurum, { color: d.renk }]} numberOfLines={1}>
          {alt ?? d.ad}
        </Text>
      </View>
      {durum === 'odendi' && <Parlama gecikme={(sira % 2) * 1200} />}
      {durum === 'odenmedi' && <Nefes />}
    </Pressable>
  );
}

// Lejant: durumların renk/ikon açıklaması ve (verilirse) sayıları. ogeler: [[durum, sayi], ...]
export function Lejant({ ogeler }) {
  return (
    <View style={styles.lejant}>
      {ogeler.map(([durum, sayi]) => (
        <View key={durum} style={styles.lejantOge}>
          <Ikon ad={DURUMLAR[durum].ikon} boyut={15} renk={DURUMLAR[durum].renk} />
          <Text style={[styles.lejantYazi, { color: RENKLI.includes(durum) ? DURUMLAR[durum].renk : renkler.soluk }]}>
            {DURUMLAR[durum].ad}
            {sayi !== undefined && <Text style={styles.lejantSayi}> {sayi}</Text>}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Durum rozeti: küçük renkli etiket (örn. "Onay bekliyor"). yazi verilmezse durumun adı yazılır.
export function DurumRozeti({ durum, yazi }) {
  const d = DURUMLAR[durum];
  return (
    <View style={[styles.rozet, { backgroundColor: karistir(d.renk, 0.12), borderColor: karistir(d.renk, 0.4) }]}>
      <Ikon ad={d.ikon} boyut={15} renk={d.renk} />
      <Text style={[styles.rozetYazi, { color: d.renk }]}>{yazi ?? d.ad}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  basili: {
    opacity: 0.7,
  },
  // Daire kutusu: genişliği dışarıdan (satırdaki yer) belirlenir, yüksekliği genişliğe oranla
  daire: {
    flex: 1,
    flexBasis: 0,
    aspectRatio: 1 / 0.92,
    borderRadius: kose,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  // Sakini olmayan daire: çok soluk çapraz çizgi deseni (10 px'lik karo tekrar eder, her karoda iki ince çizgi)
  cizgili: {
    experimental_backgroundImage:
      'linear-gradient(135deg, transparent 43%, rgba(255,255,255,0.025) 43%, rgba(255,255,255,0.025) 50%, transparent 50%, transparent 93%, rgba(255,255,255,0.025) 93%)',
    experimental_backgroundSize: '10px 10px',
    experimental_backgroundRepeat: 'repeat',
  },
  daireKucuk: {
    aspectRatio: 1,
  },
  daireAd: {
    fontFamily: yaziTipi.mono,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  daireAdKucuk: {
    fontSize: 12,
  },
  parlama: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  nefes: {
    backgroundColor: renkler.hata,
    borderWidth: 1.5,
    borderColor: renkler.hata,
    borderRadius: kose,
  },
  ay: {
    flex: 1,
    flexBasis: 0,
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: kose,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ayIkon: {
    width: 32,
    height: 32,
    borderRadius: kose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayMetin: {
    flex: 1,
  },
  ayAd: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  ayDurum: {
    fontFamily: yaziTipi.metin,
    fontSize: 12,
    fontWeight: '500',
  },
  lejant: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
  },
  lejantOge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lejantYazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 13,
  },
  lejantSayi: {
    fontFamily: yaziTipi.mono,
    fontWeight: '600',
    color: renkler.yazi,
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: kose,
    borderWidth: 1,
  },
  rozetYazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

// Bina kartı: "A Blok" başlığı, sağda daire sayısı ve daireler 4'lü hizalı satırlarda.
// daireler: [{ id, ad, durum }], daireBasinca: daireye basınca çalışır (verilmezse kutular basılamaz).
// ikonsuz / kucuk / sutun: DaireKutusu'na ve satır uzunluğuna aktarılır (kurulum önizlemesinde 6 sütun, küçük kutu).
export function BinaKarti({ ad, daireler, daireBasinca, ikonsuz, kucuk, sutun = 4, cercevesiz = false }) {
  // Daireler sutun'arlı satırlara bölünür; son satır boş yer tutucularla tamamlanır ki kutular hizalı kalsın.
  const satirlar = [];
  for (let i = 0; i < daireler.length; i += sutun) satirlar.push(daireler.slice(i, i + sutun));
  return (
    <View style={[styles.bina, cercevesiz && styles.binaCercevesiz]}>
      <View style={styles.binaUst}>
        <Text style={styles.binaAd}>{ad} Blok</Text>
        <Text style={styles.binaSayi}>{`${daireler.length} DAİRE`}</Text>
      </View>
      <View style={[styles.satirlar, kucuk && { gap: 5 }]}>
        {satirlar.map((satir, s) => (
          <View key={s} style={[styles.satir, kucuk && { gap: 5 }]}>
            {Array.from({ length: sutun }, (_, i) =>
              satir[i] ? (
                <DaireKutusu
                  key={satir[i].id}
                  ad={satir[i].ad}
                  durum={satir[i].durum}
                  ikonsuz={ikonsuz}
                  kucuk={kucuk}
                  sira={s * sutun + i}
                  erisimAdi={satir[i].erisimAdi}
                  onPress={daireBasinca && (() => daireBasinca(satir[i]))}
                />
              ) : (
                <View key={i} style={styles.yerTutucu} />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const binaStilleri = StyleSheet.create({
  bina: {
    padding: 14,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  binaCercevesiz: {
    padding: 0,
    borderWidth: 0,
  },
  binaUst: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  binaAd: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    fontWeight: '700',
    color: renkler.yazi,
  },
  binaSayi: {
    fontFamily: yaziTipi.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: renkler.soluk,
  },
  satirlar: {
    gap: 8,
  },
  satir: {
    flexDirection: 'row',
    gap: 8,
  },
  yerTutucu: {
    flex: 1,
    flexBasis: 0,
  },
});
Object.assign(styles, binaStilleri);
