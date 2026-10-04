// Kurulum ekranı: yönetici bina sayısını ve her binadaki daire sayısını girer.
// Sayılar −/+ düğmeleriyle veya ortadaki kutuya yazarak değiştirilir. Altta oluşacak dairelerin önizlemesi
// (A1–A6, B1–B6...) canlı olarak görünür. Sistem daireleri otomatik oluşturur ve her birine davet kodu verir.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { BinaKarti } from '../components/Durum';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

// Bina adları için kullanılan harfler (en fazla 26 bina).
const HARFLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Sayı satırı: solda etiket ve sınır bilgisi, sağda − kutu + adımlayıcı.
// −/+ değeri 1 azaltır/artırır (en az 1, en fazla enFazla); ortadaki kutuya elle de yazılabilir (sadece rakam).
function SayiAlani({ etiket, alt, deger, degistir, enFazla }) {
  const sayi = Number(deger) || 0;
  // −/+ basınca çalışır: yeni değer 1 ile enFazla arasında tutulur
  const adim = (fark) => degistir(String(Math.min(enFazla, Math.max(1, sayi + fark))));
  return (
    <View style={styles.satir}>
      <View style={styles.satirMetin}>
        <Text style={styles.etiket}>{etiket}</Text>
        <Text style={styles.alt}>{alt}</Text>
      </View>
      <View style={styles.adimlayici}>
        {/* "−" düğmesi: basınca değer 1 azalır */}
        <Pressable style={({ pressed }) => [styles.adimDugme, pressed && styles.basili]} onPress={() => adim(-1)} accessibilityRole="button" accessibilityLabel={`${etiket} azalt`}>
          <Text style={styles.adimYazi}>−</Text>
        </Pressable>
        <TextInput
          style={styles.kutu}
          value={deger}
          onChangeText={(metin) => degistir(metin.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          accessibilityLabel={etiket}
        />
        {/* "+" düğmesi (zümrüt): basınca değer 1 artar */}
        <Pressable style={({ pressed }) => [styles.adimDugme, styles.arti, pressed && styles.basili]} onPress={() => adim(1)} accessibilityRole="button" accessibilityLabel={`${etiket} artır`}>
          <Text style={[styles.adimYazi, { color: renkler.zumrutUzeri }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// navigation: kurulum bitince ana ekrana geri dönmek için kullanılır.
export default function KurulumEkrani({ navigation }) {
  // useState: iki kutudaki değerler (metin olarak tutulur, gönderirken sayıya çevrilir). Örnek değerlerle başlar.
  const [binaSayisi, setBinaSayisi] = useState('2');
  const [daireSayisi, setDaireSayisi] = useState('6');
  // useState: istek sürerken true; butonda dönen simge çıkar, kurulum iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);
  // useState: geçersiz giriş veya sunucu hatasında gösterilecek mesaj.
  const [hata, setHata] = useState('');

  const bina = Number(binaSayisi);
  const daire = Number(daireSayisi);
  const gecerli = bina >= 1 && bina <= 26 && daire >= 1 && daire <= 99;
  const sonBina = HARFLER[bina - 1];

  // "Daireleri oluştur"a basınca çalışır: sayıları kontrol eder, sonra işlem geri alınamaz olduğu için onay sorar.
  const onayIste = () => {
    if (!binaSayisi || !daireSayisi) {
      setHata('Bina sayısını ve her binadaki daire sayısını girin.');
      return;
    }
    if (bina < 1 || daire < 1) {
      setHata('Sayılar en az 1 olmalı.');
      return;
    }
    if (bina > 26) {
      setHata('En fazla 26 bina olabilir (A–Z).');
      return;
    }
    setHata('');
    Alert.alert(
      'Kurulumu onayla',
      `${bina} bina, toplam ${bina * daire} daire oluşturulacak (A1 – ${sonBina}${daire}). Bu işlem daha sonra değiştirilemez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Oluştur', onPress: kurulumYap },
      ],
    );
  };

  // API isteği: POST /api/kurulum ile bina ve daire sayısını gönderir; daireler ve davet kodları sunucuda oluşur.
  // Başarılıysa ana ekrana dönülür (orada kurulum tamamlanmış görünür).
  const kurulumYap = async () => {
    setYukleniyor(true);
    try {
      await api.post('/kurulum', { binaSayisi: bina, daireSayisi: daire });
      navigation.goBack();
    } catch (e) {
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  // Önizleme: en fazla 3 bina ve her binada en fazla 12 daire gösterilir (fazlası "+N" ile belirtilir)
  const onizleme = gecerli
    ? Array.from({ length: Math.min(bina, 3) }, (_, b) => ({
        ad: HARFLER[b],
        daireler: Array.from({ length: Math.min(daire, 12) }, (_, d) => ({ id: `${b}-${d}`, ad: `${HARFLER[b]}${d + 1}`, durum: 'bosDaire' })),
      }))
    : [];

  return (
    // KeyboardAwareScrollView: klavye açılınca kutular ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView style={styles.dis} contentContainerStyle={styles.icerik} bottomOffset={100} keyboardShouldPersistTaps="handled">
      <Text style={yazilar.aciklama}>Binalar A, B, C… diye, daireler A1, A2… diye otomatik adlandırılır.</Text>

      <SayiAlani etiket="Bina sayısı" alt="En fazla 26 (A–Z)" deger={binaSayisi} degistir={setBinaSayisi} enFazla={26} />
      <SayiAlani etiket="Her binadaki daire" alt="En fazla 99" deger={daireSayisi} degistir={setDaireSayisi} enFazla={99} />

      {/* İki sayı da geçerliyse oluşacak daireler canlı olarak önizlenir */}
      {gecerli && (
        <View style={styles.kart}>
          <View style={styles.kartUst}>
            <Text style={yazilar.etiket}>ÖNİZLEME</Text>
            <Text style={styles.alt}>
              {bina * daire} daire · {bina * daire} davet kodu
            </Text>
          </View>
          {onizleme.map((b) => (
            <BinaKarti key={b.ad} ad={b.ad} daireler={b.daireler} ikonsuz kucuk sutun={6} cercevesiz />
          ))}
          {(bina > 3 || daire > 12) && <Text style={styles.alt}>… A1 – {sonBina}{daire} arası tüm daireler oluşturulur.</Text>}
        </View>
      )}

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Daireleri oluştur" butonu: basınca onayIste çalışır; onaylanırsa kurulumYap backend'e gönderir */}
      <Buton baslik="Daireleri oluştur" ikon="kurulum" onPress={onayIste} yukleniyor={yukleniyor} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 18,
    gap: 12,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  satirMetin: {
    flex: 1,
  },
  etiket: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  alt: {
    fontFamily: yaziTipi.metin,
    fontSize: 12,
    color: renkler.soluk,
  },
  adimlayici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: kose,
    backgroundColor: renkler.yuzey2,
  },
  adimDugme: {
    width: 38,
    height: 38,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arti: {
    backgroundColor: renkler.zumrutDolgu,
  },
  basili: {
    opacity: 0.7,
  },
  adimYazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 20,
    fontWeight: '600',
    color: renkler.yazi,
  },
  kutu: {
    width: 40,
    padding: 0,
    textAlign: 'center',
    fontFamily: yaziTipi.mono,
    fontSize: 18,
    fontWeight: '600',
    color: renkler.yazi,
  },
  kart: {
    padding: 16,
    gap: 12,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  kartUst: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
