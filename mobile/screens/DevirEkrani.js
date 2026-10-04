// Yöneticiliği devret ekranı: yönetici, sitedeki bir dairenin sakinini yeni yönetici yapar; kendisi sakin olur.
// Önce yeni yöneticinin dairesi seçilir (örn. "B12 · Ahmet"). Yöneticinin kayıtlı bir dairesi yoksa (siteyi kuran
// yönetici) devirden sonra oturacağı boş daire de seçilir. Devirden sonra ekranlar kendiliğinden sakin ekranlarına geçer.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { karistir, kose, renkler, yaziTipi, yazilar } from '../tema';

// Daire adına Türkçe yönelme eki: "A3" → "A3'e", "B6" → "B6'ya", "A10" → "A10'a" (sayının okunuşuna göre).
const BIRLER = ["'a", "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"];
const ONLAR = ['', "'a", "'ye", "'a", "'a", "'ye", "'a", "'e", "'e", "'a"];
const yonelme = (ad) => {
  const sayi = Number(ad.replace(/\D/g, ''));
  return ad + (sayi % 10 === 0 && sayi > 0 ? ONLAR[(sayi / 10) % 10] : BIRLER[sayi % 10]);
};

// Seçim hücresi: eşit genişlikte kutu. renk: seçiliyken kullanılan durum rengi (yeşil = yeni yönetici gelir,
// kırmızı = sizin gideceğiniz daire). rozet: (isteğe bağlı) soldaki daire etiketi.
function Hucre({ yazi, rozet, secili, renk, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: secili }}
      style={({ pressed }) => [
        styles.hucre,
        rozet && styles.hucreKisi,
        secili && { backgroundColor: karistir(renk, 0.14), borderColor: karistir(renk, 0.6) },
        pressed && { opacity: 0.7 },
      ]}
    >
      {rozet ? (
        <View style={[styles.rozet, secili && { backgroundColor: renk }]}>
          <Text style={[styles.rozetYazi, secili && { color: renkler.arkaPlan }]}>{rozet}</Text>
        </View>
      ) : null}
      <Text style={[styles.hucreYazi, secili && { color: renk }]} numberOfLines={1}>
        {yazi}
      </Text>
    </Pressable>
  );
}

// Elemanları n'li satırlara böler; son satır boş yer tutucularla tamamlanır ki kutular hizalı kalsın.
const satirla = (liste, n) => Array.from({ length: Math.ceil(liste.length / n) }, (_, i) => liste.slice(i * n, i * n + n));

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

  // Butonun yazısı ne olacağını söyler: "A3'e devret, A4'e geç"
  const hedefDaire = secenekler.kendiDairem ?? kendiDaire;
  const butonYazisi = yeniYonetici && hedefDaire ? `${yonelme(yeniYonetici.ad)} devret, ${yonelme(hedefDaire.ad)} geç` : 'Yöneticiliği devret';

  return (
    <ScrollView style={styles.dis} contentContainerStyle={styles.icerik}>
      <Text style={yazilar.aciklama}>
        Seçtiğiniz dairenin sakini yönetici olur; siz sakin olursunuz. Daireler, aidat geçmişi ve duyurular olduğu gibi kalır.
      </Text>

      <View style={styles.bolum}>
        <View style={styles.adimNo}>
          <Text style={styles.adimNoYazi}>1</Text>
        </View>
        <Text style={styles.baslik}>Yeni yönetici</Text>
      </View>
      {secenekler.adaylar.length === 0 ? (
        <Text style={styles.bos}>Sitede henüz kayıtlı sakin yok. Yöneticilik bir sakine devredilebilir.</Text>
      ) : (
        // Adaylar 2 eşit sütunda; seçilen yeşil (yönetici olarak gelecek kişi).
        // Aday kutusu: basınca setYeniYonetici çalışır, o dairenin sakini yeni yönetici olarak seçilir.
        satirla(secenekler.adaylar, 2).map((satir, i) => (
          <View key={i} style={styles.satir}>
            {[0, 1].map((j) =>
              satir[j] ? (
                <Hucre
                  key={satir[j].daireId}
                  rozet={satir[j].ad}
                  yazi={satir[j].sakinAdi}
                  renk={renkler.basarili}
                  secili={yeniYonetici?.daireId === satir[j].daireId}
                  onPress={() => setYeniYonetici(satir[j])}
                />
              ) : (
                <View key={j} style={[styles.hucre, styles.hucreKisi, styles.yerTutucu]} />
              ),
            )}
          </View>
        ))
      )}

      <View style={styles.bolum}>
        <View style={styles.adimNo}>
          <Text style={styles.adimNoYazi}>2</Text>
        </View>
        <Text style={styles.baslik}>Sizin daireniz</Text>
      </View>
      {secenekler.kendiDairem ? (
        <Text style={yazilar.aciklama}>Devirden sonra {secenekler.kendiDairem.ad} dairesinin sakini olacaksınız.</Text>
      ) : (
        <>
          <Text style={yazilar.aciklama}>Devirden sonra oturacağınız boş daire. Seçtiğiniz daire kırmızı (siz gidiyorsunuz).</Text>
          {/* Boş daireler 5 eşit sütunda. Boş daire kutusu: basınca setKendiDaire çalışır */}
          {satirla(secenekler.bosDaireler, 5).map((satir, i) => (
            <View key={i} style={styles.satir}>
              {[0, 1, 2, 3, 4].map((j) =>
                satir[j] ? (
                  <Hucre
                    key={satir[j].id}
                    yazi={satir[j].ad}
                    renk={renkler.hata}
                    secili={kendiDaire?.id === satir[j].id}
                    onPress={() => setKendiDaire(satir[j])}
                  />
                ) : (
                  <View key={j} style={[styles.hucre, styles.yerTutucu]} />
                ),
              )}
            </View>
          ))}
          {/* Boş daire yoksa ne yapılacağı açıklanır (yoksa liste boş görünür ve kullanıcı takılı kalır) */}
          {secenekler.bosDaireler.length === 0 && (
            <Text style={styles.bos}>
              Sitede boş daire yok. Oturduğunuz dairenin sakinini önce daireden çıkarın veya yöneticiliği o daireye devredin.
            </Text>
          )}
        </>
      )}

      {/* Devret butonu: iki seçim de yapılınca devretOnayi çalışır (önce onay sorulur); eksikse uyarı çıkar */}
      <View style={styles.alt}>
        <Buton
          baslik={butonYazisi}
          ikon="devret"
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
    padding: 18,
    gap: 8,
  },
  orta: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: renkler.arkaPlan,
  },
  bolum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  adimNo: {
    width: 26,
    height: 26,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adimNoYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: renkler.soluk,
  },
  baslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  satir: {
    flexDirection: 'row',
    gap: 8,
  },
  // Yer tutucu: hücreyle aynı kutu ama görünmez; son satırdaki tek kutu genişleyip hizayı bozmasın diye
  yerTutucu: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  // flexBasis 0: yazı uzunluğundan bağımsız, satırdaki bütün kutular eşit genişlikte
  hucre: {
    flex: 1,
    flexBasis: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  hucreKisi: {
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
    minHeight: 52,
  },
  hucreYazi: {
    flexShrink: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    fontWeight: '600',
    color: renkler.yazi,
  },
  rozet: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
  },
  rozetYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: renkler.yazi,
  },
  bos: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    lineHeight: 20,
    color: renkler.soluk,
  },
  alt: {
    marginTop: 16,
  },
});
