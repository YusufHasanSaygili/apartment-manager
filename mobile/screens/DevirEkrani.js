// Yöneticiliği devret ekranı: yönetici, sitedeki bir dairenin sakinini yeni yönetici yapar; kendisi sakin olur.
// Önce yeni yöneticinin dairesi seçilir (örn. "B12 · Ahmet"). Yöneticinin kayıtlı bir dairesi yoksa (siteyi kuran
// yönetici) devirden sonra oturacağı boş daire de seçilir. Devirden sonra ekranlar kendiliğinden sakin ekranlarına geçer.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

// Seçilebilir küçük kutu (daire düğmesi). secili ise dolu renkli görünür.
// Bu ekranda iki ayrı listede aynı görünüm kullanıldığı için küçük bir component olarak yazıldı.
function SecimDugmesi({ yazi, secili, onPress }) {
  return (
    // Daire düğmesi: basınca onPress çalışır ve bu daire seçilir.
    <Pressable
      style={[styles.dugme, secili && styles.dugmeSecili]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: secili }}
    >
      <Text style={[styles.dugmeYazi, secili && styles.dugmeYaziSecili]}>{yazi}</Text>
    </Pressable>
  );
}

export default function DevirEkrani() {
  // oturumuYenile: devirden sonra rolü sunucudan yeniden çeker; App.js sakin ekranlarına geçer.
  const { oturumuYenile } = useOturum();

  // useState: sunucudan gelen seçenekler { adaylar, kendiDairem, bosDaireler }. null → yükleniyor.
  const [secenekler, setSecenekler] = useState(null);
  // useState: seçenekler yüklenemezse hata mesajı; doluysa ekranda "Tekrar dene" kutusu gösterilir.
  const [hata, setHata] = useState('');
  // useState: seçilen yeni yöneticinin dairesi ve (gerekiyorsa) yöneticinin kendi oturacağı daire.
  const [yeniYonetici, setYeniYonetici] = useState(null);
  const [kendiDaire, setKendiDaire] = useState(null);
  // useState: devir isteği sürerken true; buton tekrar basılamaz.
  const [devrediliyor, setDevrediliyor] = useState(false);

  // API isteği: GET /api/devir/secenekler ile sakini olan daireleri ve boş daireleri çeker.
  // useCallback: fonksiyon sabit kalsın; useEffect bağımlılığı ve "Tekrar dene" butonu aynı fonksiyonu kullanır.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/devir/secenekler');
      setSecenekler(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useEffect: ekran ilk açıldığında seçenekler bir kez yüklenir.
  useEffect(() => {
    yukle();
  }, [yukle]);

  // Kendi dairesi kayıtlıysa seçmesine gerek yok; değilse boş dairelerden birini seçmek zorunlu.
  const kendiDaireGerekli = secenekler && !secenekler.kendiDairem;
  // hazir: gerekli tüm seçimler yapıldı mı; değilse devret butonu sadece uyarı gösterir.
  const hazir = yeniYonetici && (!kendiDaireGerekli || kendiDaire);

  // API isteği: POST /api/devir ile seçimleri gönderir. Başarılıysa oturum yenilenir ve uygulama
  // kendiliğinden sakin ekranlarına geçer (bu ekran da kapanır).
  const devret = async () => {
    setDevrediliyor(true);
    try {
      const { data } = await api.post('/devir', {
        yeniYoneticiDaireId: yeniYonetici.daireId,
        // kendiDaireId sadece gerekiyorsa eklenir (false yayılınca hiçbir alan eklenmez).
        ...(kendiDaireGerekli && { kendiDaireId: kendiDaire.id }),
      });
      Alert.alert('Devir tamamlandı', `Yöneticilik ${data.yeniYonetici} adlı sakine devredildi. Artık sakin olarak devam ediyorsunuz.`);
      await oturumuYenile();
    } catch (e) {
      Alert.alert('Devredilemedi', e.message);
      setDevrediliyor(false);
      // Liste eskimiş olabilir (örn. seçilen daire bu arada doldu): seçimler sıfırlanır, seçenekler yeniden çekilir.
      setYeniYonetici(null);
      setKendiDaire(null);
      yukle();
    }
  };

  // Devir geri alınamaz (geri almak için yeni yöneticinin tekrar devretmesi gerekir); önce onay sorulur.
  const devretOnayi = () => {
    const kendi = kendiDaireGerekli ? kendiDaire.ad : secenekler.kendiDairem.ad;
    Alert.alert(
      'Yöneticiliği devret',
      `${yeniYonetici.ad} dairesindeki ${yeniYonetici.sakinAdi} yönetici olacak. Siz ${kendi} dairesinin sakini olacaksınız ve yönetici ekranlarına erişiminiz kalkacak. Onaylıyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Devret', style: 'destructive', onPress: devret },
      ]
    );
  };

  if (hata !== '') {
    return (
      <View style={styles.orta}>
        {/* "Tekrar dene" butonu: basınca yukle çalışır ve seçenekler yeniden istenir */}
        <HataMesaji mesaj={hata} tekrarDene={yukle} />
      </View>
    );
  }
  if (!secenekler) {
    return (
      <View style={styles.orta}>
        <ActivityIndicator color={renkler.birincil} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.dis} contentContainerStyle={styles.icerik}>
      <Text style={styles.aciklama}>
        Seçtiğiniz dairenin sakini yönetici olur; siz sakin olursunuz. Daireler, aidat geçmişi ve duyurular olduğu gibi kalır.
      </Text>

      <Text style={styles.baslik}>1. Yeni yönetici</Text>
      {secenekler.adaylar.length === 0 ? (
        <Text style={styles.bos}>Sitede henüz kayıtlı sakin yok. Yöneticilik bir sakine devredilebilir.</Text>
      ) : (
        <View style={styles.liste}>
          {/* Aday düğmeleri: basınca setYeniYonetici çalışır, o dairenin sakini yeni yönetici olarak seçilir */}
          {secenekler.adaylar.map((a) => (
            <SecimDugmesi
              key={a.daireId}
              yazi={`${a.ad} · ${a.sakinAdi}`}
              secili={yeniYonetici?.daireId === a.daireId}
              onPress={() => setYeniYonetici(a)}
            />
          ))}
        </View>
      )}

      <Text style={styles.baslik}>2. Sizin daireniz</Text>
      {secenekler.kendiDairem ? (
        <Text style={styles.bilgi}>Devirden sonra {secenekler.kendiDairem.ad} dairesinin sakini olacaksınız.</Text>
      ) : (
        <>
          <Text style={styles.bilgi}>Devirden sonra oturacağınız daireyi seçin (sadece boş daireler):</Text>
          <View style={styles.liste}>
            {/* Boş daire düğmeleri: basınca setKendiDaire çalışır, yönetici devirden sonra oturacağı daireyi seçer */}
            {secenekler.bosDaireler.map((d) => (
              <SecimDugmesi key={d.id} yazi={d.ad} secili={kendiDaire?.id === d.id} onPress={() => setKendiDaire(d)} />
            ))}
          </View>
          {/* Boş daire yoksa ne yapılacağı açıklanır (yoksa liste boş görünür ve kullanıcı takılı kalır) */}
          {secenekler.bosDaireler.length === 0 && (
            <Text style={styles.bos}>
              Sitede boş daire yok. Oturduğunuz dairenin sakinini önce daireden çıkarın veya yöneticiliği o daireye devredin.
            </Text>
          )}
        </>
      )}

      {/* "Yöneticiliği devret" butonu: iki seçim de yapılınca açılır; basınca devretOnayi çalışır (önce onay sorulur) */}
      <View style={styles.alt}>
        <Buton
          baslik="Yöneticiliği devret"
          onPress={hazir ? devretOnayi : () => Alert.alert('Seçim eksik', 'Önce yeni yöneticiyi ve dairenizi seçin.')}
          yukleniyor={devrediliyor}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 24,
    gap: 12,
  },
  orta: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: renkler.arkaPlan,
  },
  aciklama: {
    fontSize: 15,
    lineHeight: 22,
    color: renkler.soluk,
  },
  baslik: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  bilgi: {
    fontSize: 15,
    lineHeight: 22,
    color: renkler.yazi,
  },
  bos: {
    fontSize: 15,
    color: renkler.soluk,
  },
  liste: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dugme: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  dugmeSecili: {
    borderColor: renkler.birincil,
    backgroundColor: renkler.birincil,
  },
  dugmeYazi: {
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  dugmeYaziSecili: {
    color: renkler.birincilUzeri,
  },
  alt: {
    marginTop: 16,
  },
});
