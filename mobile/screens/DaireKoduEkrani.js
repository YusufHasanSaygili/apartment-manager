// Daire kodu ekranı: alttan açılan pencere (form sheet). Seçilen dairenin davet kodunu
// büyük puntoyla gösterir ve kodu WhatsApp, SMS vb. ile paylaşmayı sağlar.
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import { renkler } from '../tema';

// route.params: daire listesinden gönderilen daire adı (örn. "A3"), davet kodu ve dolu bilgisi.
export default function DaireKoduEkrani({ route, navigation }) {
  const { daireAdi, davetKodu, dolu } = route.params;
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

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.baslik}>Daire {daireAdi}</Text>
      <Text style={styles.aciklama}>Davet kodu</Text>
      {/* selectable: kod basılı tutularak kopyalanabilir. letterSpacing: rakamlar rahat okunur. */}
      <Text style={styles.kod} selectable accessibilityLabel={`Davet kodu ${davetKodu.split('').join(' ')}`}>
        {davetKodu}
      </Text>
      {/* Kod tek kullanımlık: kullanıldıysa paylaşma butonu gösterilmez */}
      {dolu ? (
        <Text style={styles.not}>Bu kod kullanıldı. Dairede kayıtlı bir sakin var.</Text>
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
