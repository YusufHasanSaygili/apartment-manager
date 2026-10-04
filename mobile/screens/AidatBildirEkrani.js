// Aidat bildirimi ekranı: sakin hangi ayın aidatını, ne kadar ve nasıl ödediğini yöneticiye bildirir.
// Yönetici onaylayınca o ay ödenmiş sayılır.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { AY_ADLARI, tutarMetni, tutarOku, tutarTemizle } from '../bicim';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

// Bu ay ve önceki 11 ay: [{ ay, yil }, ...] (en yeni başta). Backend de sadece bu aralığı kabul eder.
function son12Ay() {
  const bugun = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const tarih = new Date(bugun.getFullYear(), bugun.getMonth() - i, 1);
    return { ay: tarih.getMonth() + 1, yil: tarih.getFullYear() };
  });
}

// Seçenek kutusu: ay ve ödeme yöntemi seçimlerinde kullanılır. Satırdaki kutular eşit genişlikte (hizalı);
// seçiliyse koyu altın zemin + altın çerçeve. alt: (isteğe bağlı) altında küçük yazı (örn. yıl).
function Secenek({ yazi, alt, secili, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.secenek, secili && styles.secili, pressed && styles.basili]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: secili }}
      accessibilityLabel={alt ? `${yazi} ${alt}` : yazi}
    >
      <Text style={[styles.secenekYazi, secili && styles.seciliYazi]}>{yazi}</Text>
      {alt ? <Text style={[styles.secenekAlt, secili && styles.seciliYazi]}>{alt}</Text> : null}
    </Pressable>
  );
}

// 12 ayı 3'lü satırlara böler (4 satır × 3 eşit kutu)
const satirla = (liste) => Array.from({ length: Math.ceil(liste.length / 3) }, (_, i) => liste.slice(i * 3, i * 3 + 3));

// route.params.aidatTutari: yöneticinin belirlediği aylık tutar (sakin ana ekranından gelir).
export default function AidatBildirEkrani({ route, navigation }) {
  // Ekrandaki ay düğmelerinin listesi (bu ay + önceki 11 ay).
  const aylar = son12Ay();

  // useState: seçilen ay. Reddedilen bir bildirimden gelindiyse o ay (listede varsa), yoksa bu ay.
  // useState'e fonksiyon verilir: bu arama sadece ekran ilk açıldığında bir kez yapılır.
  const [secilenAy, setSecilenAy] = useState(
    () => aylar.find((a) => a.ay === route.params?.ay && a.yil === route.params?.yil) ?? aylar[0]
  );
  // useState: tutar kutusundaki metin. Yöneticinin tutarı hazır gelir, sakin değiştirebilir
  // (örn. 2 aylık ödediyse 1500 yazar).
  const [tutar, setTutar] = useState(tutarMetni(route.params?.aidatTutari));
  // useState: ödeme yöntemi ('banka' | 'elden'); başta seçili değil, sakin seçmeli.
  const [odemeYontemi, setOdemeYontemi] = useState(null);
  // useState: isteğe bağlı açıklama (örn. "Ziraat'ten 1 Ekim'de attım").
  const [aciklama, setAciklama] = useState('');

  // useState: istek sürerken true; form iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);
  // useState: formda veya sunucuda hata olursa gösterilecek mesaj.
  const [hata, setHata] = useState('');

  // gonder: "Bildirimi gönder" butonuna basınca çalışır. Telefonda kontrol eder, sonra backend'e yollar.
  const gonder = async () => {
    // Telefondaki kontroller kullanıcıya hızlı geri bildirim içindir; asıl kontrol backend'de tekrar yapılır.
    const sayi = tutarOku(tutar);
    if (!(sayi > 0)) {
      setHata('Geçerli bir tutar girin.');
      return;
    }
    if (sayi > 99999.99) {
      setHata('Tutar en fazla 99.999,99 TL olabilir.');
      return;
    }
    if (!odemeYontemi) {
      setHata('Ödeme yöntemini seçin.');
      return;
    }

    setHata('');
    setYukleniyor(true);
    try {
      // API isteği: seçilen ay, tutar, yöntem ve açıklamayı POST /api/aidatlar adresine gönderir.
      // Daire ve site bilgisi gönderilmez; backend bunları sakinin token'ından bulur.
      await api.post('/aidatlar', { ...secilenAy, tutar: sayi, odemeYontemi, aciklama });
      // Ana ekrana dönülür; ana ekran öne gelince listeyi yeniden çeker ve yeni bildirim "Onay bekliyor" görünür.
      navigation.goBack();
    } catch (e) {
      // Örn. "Bu ay için zaten bekleyen veya onaylanmış bir bildiriminiz var."
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.grup}>
        <Text style={yazilar.etiket}>HANGİ AYIN AİDATI?</Text>
        {/* Ay kutuları: 3 eşit sütun; basınca o ay seçilir (bu ay ve önceki 11 ay) */}
        {satirla(aylar).map((satir, i) => (
          <View key={i} style={styles.satir}>
            {satir.map((a) => (
              <Secenek
                key={`${a.yil}-${a.ay}`}
                yazi={AY_ADLARI[a.ay - 1].slice(0, 3)}
                alt={String(a.yil)}
                secili={a.ay === secilenAy.ay && a.yil === secilenAy.yil}
                onPress={() => setSecilenAy(a)}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Tutar: sadece rakam ve virgül yazılabilir (tutarTemizle), örn. 1500,50 */}
      <FormAlani
        etiket="Ödenen tutar (TL)"
        value={tutar}
        onChangeText={(metin) => setTutar(tutarTemizle(metin))}
        keyboardType="decimal-pad"
        maxLength={8}
        style={styles.buyukAlan}
      />

      <View style={styles.grup}>
        <Text style={yazilar.etiket}>ÖDEME YÖNTEMİ</Text>
        {/* Ödeme yöntemi kutuları: 2 eşit sütun; basınca o yöntem seçilir */}
        <View style={styles.satir}>
          <Secenek yazi="Banka havalesi" secili={odemeYontemi === 'banka'} onPress={() => setOdemeYontemi('banka')} />
          <Secenek yazi="Elden" secili={odemeYontemi === 'elden'} onPress={() => setOdemeYontemi('elden')} />
        </View>
      </View>

      <FormAlani
        etiket="Açıklama (isteğe bağlı)"
        value={aciklama}
        onChangeText={setAciklama}
        placeholder="Örn. Ziraat'ten 1 Ekim'de attım"
        maxLength={200}
        multiline
        style={styles.buyukAlan}
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Bildirimi gönder" butonu: basınca gonder çalışır ve bildirim backend'e gönderilir */}
      <Buton baslik="Bildirimi gönder" ikon="gonder" onPress={gonder} yukleniyor={yukleniyor} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  // Ferah düzen: bölümler arası geniş boşluk, büyük kutular (ekranın altında boşluk kalmasın)
  icerik: {
    padding: 18,
    paddingTop: 14,
    gap: 14,
  },
  grup: {
    gap: 10,
  },
  satir: {
    flexDirection: 'row',
    gap: 10,
  },
  // flexBasis 0: yazı uzunluğundan bağımsız, satırdaki kutular eşit genişlikte
  secenek: {
    flex: 1,
    flexBasis: 0,
    minHeight: 60,
    paddingHorizontal: 6,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.kart,
  },
  secili: {
    borderColor: renkler.birincil,
    backgroundColor: renkler.birincilZemin,
  },
  basili: {
    opacity: 0.7,
  },
  secenekYazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 15.5,
    fontWeight: '600',
    color: renkler.yazi,
  },
  secenekAlt: {
    fontFamily: yaziTipi.mono,
    fontSize: 10.5,
    color: renkler.soluk,
  },
  seciliYazi: {
    color: renkler.birincil,
  },
  buyukAlan: {
    minHeight: 58,
  },
});
