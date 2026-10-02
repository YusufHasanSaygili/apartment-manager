// Kurulum ekranı: yönetici bina sayısını ve her binadaki daire sayısını girer.
// Sistem daireleri A1, A2... B1, B2... diye otomatik oluşturur ve her birine davet kodu verir.
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

// Bina adları için kullanılan harfler (en fazla 26 bina).
const HARFLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Tek satırlık sayı alanı: solda etiket, sağda en fazla 2 haneli küçük kutu.
// Sadece rakam kabul eder: yazılan metindeki rakam olmayan karakterler silinir.
function SayiAlani({ etiket, deger, degistir }) {
  return (
    <View style={styles.satir}>
      <Text style={styles.etiket}>{etiket}</Text>
      <TextInput
        style={styles.kutu}
        value={deger}
        onChangeText={(metin) => degistir(metin.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
        accessibilityLabel={etiket}
      />
    </View>
  );
}

// navigation: kurulum bitince ana ekrana geri dönmek için kullanılır.
export default function KurulumEkrani({ navigation }) {
  // useState: iki kutudaki değerler (metin olarak tutulur, gönderirken sayıya çevrilir).
  const [binaSayisi, setBinaSayisi] = useState('');
  const [daireSayisi, setDaireSayisi] = useState('');

  // useState: istek sürerken true; butonda dönen simge çıkar, kurulum iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);

  // useState: hata olursa gösterilecek mesaj.
  const [hata, setHata] = useState('');

  const bina = Number(binaSayisi);
  const daire = Number(daireSayisi);
  // İki değer de geçerliyse kullanıcıya ne oluşacağı önceden gösterilir (örn. "A1 – C12").
  const gecerli = bina >= 1 && bina <= 26 && daire >= 1;
  const sonBina = HARFLER[bina - 1];

  // Kurulum geri alınamaz; bu yüzden önce özet gösterilip onay istenir.
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
      ]
    );
  };

  // Onay penceresinde "Oluştur" seçilince çalışır: kurulumu backend'e gönderir.
  const kurulumYap = async () => {
    setYukleniyor(true);
    try {
      // API isteği: iki sayıyı POST /api/kurulum adresine gönderir. Backend siteyi token'dan
      // bulur; binaları, daireleri ve davet kodlarını oluşturur.
      await api.post('/kurulum', { binaSayisi: bina, daireSayisi: daire });
      // Ana ekrana dönülür; ana ekran açılınca özeti yeniden çeker.
      navigation.goBack();
    } catch (e) {
      // e.message: ortak API servisinin hazırladığı Türkçe hata mesajı (örn. "kurulum zaten yapılmış").
      // yukleniyor sadece hatada kapatılır; başarıda ekran zaten kapanıyor.
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
      <Text style={styles.aciklama}>
        Binalar A, B, C... diye, daireler A1, A2... diye otomatik adlandırılır. Her daireye sakinlerin
        katılması için 6 haneli bir davet kodu verilir.
      </Text>

      <SayiAlani etiket="Bina sayısı" deger={binaSayisi} degistir={setBinaSayisi} />
      <SayiAlani etiket="Her binada kaç daire var" deger={daireSayisi} degistir={setDaireSayisi} />

      {/* İki sayı da geçerliyse oluşacak dairelerin özeti canlı olarak gösterilir */}
      {gecerli && (
        <Text style={styles.ozet}>
          Toplam {bina * daire} daire: A1 – {sonBina}
          {daire}
        </Text>
      )}

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Daireleri oluştur" butonu: basınca onayIste çalışır; onaylanırsa kurulumYap backend'e gönderir */}
      <Buton baslik="Daireleri oluştur" onPress={onayIste} yukleniyor={yukleniyor} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 24,
    gap: 16,
  },
  aciklama: {
    fontSize: 15,
    lineHeight: 22,
    color: renkler.soluk,
  },
  // Etiket solda, kutu sağda: aynı satırda.
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: renkler.kart,
  },
  etiket: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  // 2 haneye yetecek kadar dar, ortalanmış büyük rakamlı kutu.
  kutu: {
    width: 72,
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: renkler.yazi,
  },
  ozet: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: renkler.birincil,
  },
});
