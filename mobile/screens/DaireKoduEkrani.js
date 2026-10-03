// Daire kodu ekranı: alttan açılan pencere (form sheet). Seçilen dairenin davet kodunu
// büyük puntoyla gösterir ve kodu WhatsApp, SMS vb. ile paylaşmayı sağlar.
// Dairede sakin varsa adı gösterilir ve yönetici "Sakini daireden çıkar" ile daireyi boşaltabilir
// (daire el değiştirdiğinde); o zaman daireye yeni davet kodu verilir ve burada hemen gösterilir.
import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import { renkler } from '../tema';

// route.params: daire listesinden gönderilen daire kimliği, adı (örn. "A3"), davet kodu, dolu bilgisi ve sakinin adı.
export default function DaireKoduEkrani({ route, navigation }) {
  // yoneticiDairesi: dairede sitenin yöneticisi oturuyor (devirle yönetici olmuş); çıkarma butonu gösterilmez.
  const { daireId, daireAdi, sakinAdi, yoneticiDairesi } = route.params;
  // useState: davet kodu ve dolu bilgisi listeden gelen değerlerle başlar; sakin çıkarılınca yeni kod
  // gelir ve daire boş olur. State olduğu için ekran kendiliğinden yeni kodu gösterir.
  const [davetKodu, setDavetKodu] = useState(route.params.davetKodu);
  const [dolu, setDolu] = useState(route.params.dolu);
  // useState: çıkarma isteği sürerken true; buton dönen simge gösterir ve tekrar basılamaz.
  const [cikariliyor, setCikariliyor] = useState(false);
  // useOturum: giriş yapan kullanıcının oturum bilgisi; paylaşım mesajına site adını koymak için gerekir.
  const { oturum } = useOturum();

  // Share: telefonun kendi paylaşım menüsünü açar (ek kütüphane gerekmez).
  // Sakine gidecek hazır mesajda site adı, daire ve kod bulunur.
  const paylas = async () => {
    try {
      await Share.share({
        message: `Apartmanım uygulamasında ${oturum.site.ad} sitesine katılmak için davet kodunuz: ${davetKodu} (Daire ${daireAdi})`,
      });
    } catch {
      Alert.alert('Paylaşılamadı', 'Paylaşım menüsü açılamadı. Lütfen tekrar deneyin.');
    }
  };

  // API isteği: POST /api/daireler/:id/sakini-cikar. Sakinin daireyle bağı kesilir, hesabı giriş yapamaz olur
  // ve sunucu daireye yeni davet kodu verir; yeni kod ekranda gösterilir ve paylaşılabilir.
  const sakiniCikar = async () => {
    setCikariliyor(true);
    try {
      const { data } = await api.post(`/daireler/${daireId}/sakini-cikar`);
      setDavetKodu(data.davetKodu);
      setDolu(false);
    } catch (e) {
      Alert.alert('Sakin çıkarılamadı', e.message);
    } finally {
      setCikariliyor(false);
    }
  };

  // Çıkarma geri alınamaz; önce onay sorulur. "Çıkar" seçilirse sakiniCikar çalışır.
  const cikarOnayi = () =>
    Alert.alert(
      'Sakini daireden çıkar',
      `${sakinAdi ?? 'Sakin'} ${daireAdi} dairesinden çıkarılsın mı? Hesabı bir daha giriş yapamaz ve daireye yeni davet kodu verilir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: sakiniCikar },
      ]
    );

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.baslik}>Daire {daireAdi}</Text>
      <Text style={styles.aciklama}>Davet kodu</Text>
      {/* selectable: kod basılı tutularak kopyalanabilir. letterSpacing: rakamlar rahat okunur. */}
      <Text style={styles.kod} selectable accessibilityLabel={`Davet kodu ${davetKodu.split('').join(' ')}`}>
        {davetKodu}
      </Text>
      {/* Üç durum: 1) dairede yönetici oturuyor → sadece bilgi yazısı (çıkarma butonu yok, backend de engeller);
          2) kod kullanılmış (dolu) → sakinin adı ve "Sakini daireden çıkar"; 3) boş → "Kodu paylaş".
          Kod tek kullanımlık: kullanıldıysa paylaşma butonu gösterilmez */}
      {yoneticiDairesi ? (
        <Text style={styles.not}>Bu daire site yöneticisine ait.</Text>
      ) : dolu ? (
        <>
          <Text style={styles.not}>
            Bu kod kullanıldı. Dairede oturan sakin: {sakinAdi ?? 'kayıtlı bir sakin'}.
          </Text>
          {/* "Sakini daireden çıkar" butonu: basınca cikarOnayi çalışır (önce onay sorulur), onaylanırsa
              sakiniCikar ile sakin çıkarılır ve yeni davet kodu gösterilir */}
          <Buton baslik="Sakini daireden çıkar" tur="ikincil" yukleniyor={cikariliyor} onPress={cikarOnayi} />
        </>
      ) : (
        <>
          <Text style={styles.not}>Sakin bu kodla uygulamaya katılınca hesabı bu daireye bağlanır.</Text>
          {/* "Kodu paylaş" butonu: basınca paylas çalışır ve telefonun paylaşım menüsü açılır */}
          <Buton baslik="Kodu paylaş" onPress={paylas} />
        </>
      )}
      {/* "Kapat" butonu: basınca pencere kapanır, daire listesine dönülür */}
      <Buton baslik="Kapat" tur="ikincil" onPress={() => navigation.goBack()} />
    </View>
  );
}

const styles = StyleSheet.create({
  kapsayici: {
    padding: 24,
    gap: 12,
    backgroundColor: renkler.kart,
  },
  baslik: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: renkler.yazi,
  },
  aciklama: {
    fontSize: 15,
    textAlign: 'center',
    color: renkler.soluk,
  },
  kod: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: renkler.birincil,
  },
  not: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: renkler.soluk,
  },
});
