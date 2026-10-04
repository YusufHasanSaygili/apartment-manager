// Yönetici ana ekranı: yönetici giriş yapınca açılan ekran.
// Üstte site adı ve özet bilgi, altında bu ayın aidat durumunu gösteren hız kadranı, onun altında 2'li ızgarada
// (bento) tüm yönetici işlemleri: bekleyen aidatlar, daire haritası (mini haritayla), mesajlar, duyurular, daireler
// ve davet kodları, aidat hatırlatması, aidat tutarı, yöneticilik devri. En altta hesap kartı (çıkış, hesap silme).
// Kurulum yapılmadıysa bunların yerine 3 adımlı kurulum yol haritası görünür.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import HesapKarti from '../components/HesapKarti';
import Kutu from '../components/Kutu';
import Gosterge from '../components/Gosterge';
import Ikon from '../components/Ikon';
import { DURUMLAR } from '../components/Durum';
import { AY_ADLARI, paraBicimi } from '../bicim';
import { karistir, kose, renkler, yaziTipi, yazilar } from '../tema';

// navigation: işlemlerin ekranlarına (harita, bekleyen aidatlar, duyurular...) geçmek için kullanılır.
export default function YoneticiAnaEkrani({ navigation }) {
  // oturum burada asla null değildir: App.js bu ekranı sadece oturum açıkken gösterir.
  const { oturum } = useOturum();

  // useState: ekranın verisi { ozet, harita, okunmamis, sonDuyuru }. null → henüz yüklenmedi.
  // ozet: bina/daire sayısı, aidat tutarı, bekleyen sayısı; harita: bu ayın daire durumları (kadran ve mini harita için).
  const [veri, setVeri] = useState(null);
  // useState: veri yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');
  // useState: hatırlatma isteği sürerken true; kutuda "Gönderiliyor…" yazar, tekrar basılamaz.
  const [hatirlatiliyor, setHatirlatiliyor] = useState(false);

  const simdi = new Date();
  const ay = simdi.getMonth() + 1;
  const yil = simdi.getFullYear();

  // API istekleri (aynı anda, Promise.all): GET /api/kurulum (özet), GET /api/yonetim/aidatlar/harita (bu ayın
  // daire durumları), GET /api/mesajlar/sohbetler (okunmamış mesaj sayısı), GET /api/duyurular (son duyuru).
  // Kurulum yapılmadıysa diğerleri istenmez.
  // useCallback: yukle fonksiyonu her çizimde yeniden oluşturulmaz (sadece ay/yıl değişirse). useFocusEffect bu
  // fonksiyona bağlı olduğu için, yoksa her çizimde istek tekrar atılırdı.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data: ozet } = await api.get('/kurulum');
      if (ozet.binaSayisi === 0) {
        setVeri({ ozet });
        return;
      }
      const [harita, sohbetler, duyurular] = await Promise.all([
        api.get('/yonetim/aidatlar/harita', { params: { ay, yil } }),
        api.get('/mesajlar/sohbetler'),
        api.get('/duyurular'),
      ]);
      setVeri({
        ozet,
        harita: harita.data,
        okunmamis: sohbetler.data.reduce((t, s) => t + s.okunmamis, 0),
        sonDuyuru: duyurular.data[0]?.baslik ?? null,
      });
    } catch (e) {
      setHata(e.message);
    }
  }, [ay, yil]);

  // useFocusEffect: ekran her ÖNE GELDİĞİNDE çalışır (useEffect'ten farkı bu). Onay, mesaj okuma veya
  // kurulumdan geri dönülünce sayılar ve kadran kendiliğinden güncellenir.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle]),
  );

  // API isteği: POST /api/yonetim/aidatlar/hatirlatma ile bu ayın aidatını ödemeyen sakinlere hatırlatma gönderir.
  // Sonuçta kaç daireye gönderildiği, bildirimi kapalı sakin varsa o da yöneticiye gösterilir.
  const hatirlatmaGonder = async () => {
    setHatirlatiliyor(true);
    try {
      const { data } = await api.post('/yonetim/aidatlar/hatirlatma');
      const kapali = data.odemeyen - data.bildirimGiden;
      Alert.alert(
        'Hatırlatma gönderildi',
        data.odemeyen === 0
          ? 'Bu ay ödemeyen daire yok, kimseye hatırlatma gönderilmedi.'
          : `${data.bildirimGiden} daireye hatırlatma gönderildi.` +
              (kapali > 0 ? ` ${kapali} sakinin bildirimleri kapalı olduğu için ulaşılamadı.` : ''),
      );
    } catch (e) {
      Alert.alert('Hatırlatma gönderilemedi', e.message);
    } finally {
      setHatirlatiliyor(false);
    }
  };

  // Hatırlatma tüm ödemeyenlerin telefonuna gider; yanlışlıkla basılmasın diye önce onay sorulur.
  // "Gönder" seçilirse hatirlatmaGonder çalışır; "Vazgeç" pencereyi kapatır, istek atılmaz.
  const hatirlatmaOnayi = () => {
    if (hatirlatiliyor) return;
    Alert.alert('Aidat hatırlatması', `${AY_ADLARI[ay - 1]} ayının aidatını ödemeyen tüm sakinlere hatırlatma bildirimi gönderilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Gönder', onPress: hatirlatmaGonder },
    ]);
  };

  const ozet = veri?.ozet;
  const tutarYazi = ozet?.aidatTutari == null ? 'Belirlenmedi' : paraBicimi(ozet.aidatTutari);

  return (
    // ScrollView: içerik ekrana sığmazsa sayfa kaydırılır.
    <ScrollView style={styles.dis} contentContainerStyle={styles.icerik}>
      {/* Selamlama, site adı ve kısa özet (bina, daire, aidat) */}
      <View style={styles.selamBlok}>
        <Text style={styles.selam}>Hoş geldin, {oturum.kullanici.ad}</Text>
        <Text style={styles.siteAd}>{oturum.site.ad}</Text>
        {ozet && (
          <Text style={[yazilar.etiket, styles.siteMeta]}>
            {ozet.binaSayisi === 0
              ? 'SİTENİZ HAZIR, 3 ADIMDA KURUN'
              : `${ozet.binaSayisi} BİNA · ${ozet.daireSayisi} DAİRE · ${tutarYazi.toLocaleUpperCase('tr-TR')} / AY`}
          </Text>
        )}
      </View>

      {hata !== '' ? (
        // Hata olursa "Tekrar dene" ile yukle yeniden çalışır
        <HataMesaji mesaj={hata} tekrarDene={yukle} />
      ) : veri === null ? (
        <ActivityIndicator color={renkler.birincil} style={styles.yukleniyor} />
      ) : ozet.binaSayisi === 0 ? (
        <KurulumOncesi navigation={navigation} aidatTutari={ozet.aidatTutari} />
      ) : (
        <>
          <OzetKarti harita={veri.harita} ay={ay} yil={yil} />

          {/* Bento ızgara. "Bekleyen aidatlar": geniş, altın kutu; basınca BekleyenBildirimler ekranı açılır */}
          <Kutu
            genis
            vurgulu={ozet.bekleyenSayisi > 0}
            ikon="bekleyen"
            baslik="Bekleyen aidatlar"
            alt={ozet.bekleyenSayisi > 0 ? `${ozet.bekleyenSayisi} aidat onayınızı bekliyor` : 'Onay bekleyen aidat yok'}
            rozet={ozet.bekleyenSayisi > 0 ? String(ozet.bekleyenSayisi) : null}
            onPress={() => navigation.navigate('BekleyenBildirimler')}
          />
          <View style={styles.satir}>
            {/* "Daire haritası" kutusu (iki kutu boyunda, içinde mini harita): basınca DaireHaritasi açılır */}
            <View style={styles.sutun}>
              <Kutu ikon="harita" baslik="Daire haritası" alt="Kim ödedi, kim ödemedi" onPress={() => navigation.navigate('DaireHaritasi')}>
                <MiniHarita harita={veri.harita} />
              </Kutu>
            </View>
            <View style={styles.sutun}>
              {/* "Mesajlar" kutusu: basınca Sohbetler açılır; rozet okunmamış mesaj sayısı */}
              <Kutu
                ikon="mesaj"
                baslik="Mesajlar"
                alt={veri.okunmamis > 0 ? `${veri.okunmamis} okunmamış` : 'Yeni mesaj yok'}
                rozet={veri.okunmamis > 0 ? String(veri.okunmamis) : null}
                onPress={() => navigation.navigate('Sohbetler')}
              />
              {/* "Duyurular" kutusu: basınca Duyurular açılır; altında son duyurunun başlığı */}
              <Kutu
                ikon="duyuru"
                baslik="Duyurular"
                alt={veri.sonDuyuru ? `Son: ${veri.sonDuyuru}` : 'Henüz duyuru yok'}
                onPress={() => navigation.navigate('Duyurular')}
              />
            </View>
          </View>
          <View style={styles.satir}>
            {/* "Daireler" kutusu: basınca DaireListesi açılır (davet kodları) */}
            <Kutu ikon="anahtar" baslik="Daireler" alt="Davet kodları" onPress={() => navigation.navigate('DaireListesi')} />
            {/* "Hatırlatma gönder" kutusu: basınca önce onay sorulur (hatirlatmaOnayi), sonra hatirlatmaGonder çalışır */}
            <Kutu
              ikon="zil"
              baslik="Hatırlatma gönder"
              alt={hatirlatiliyor ? 'Gönderiliyor…' : "Her ayın 10'unda otomatik"}
              onPress={hatirlatmaOnayi}
            />
          </View>
          <View style={styles.satir}>
            {/* "Aidat tutarı" kutusu: basınca AidatTutari açılır, mevcut tutar da gönderilir */}
            <Kutu
              ikon="lira"
              baslik="Aidat tutarı"
              alt={ozet.aidatTutari == null ? 'Belirlenmedi' : `${tutarYazi} / ay`}
              onPress={() => navigation.navigate('AidatTutari', { aidatTutari: ozet.aidatTutari })}
            />
            {/* "Yöneticiliği devret" kutusu: basınca Devir açılır */}
            <Kutu ikon="devret" baslik="Yöneticiliği devret" alt="Bir sakine" onPress={() => navigation.navigate('Devir')} />
          </View>
        </>
      )}

      {/* Hesap kartı: Çıkış yap ve Hesabımı sil */}
      <HesapKarti navigation={navigation} rol="Yönetici" />
    </ScrollView>
  );
}

// Bu ayın aidat özeti: solda hız kadranı (ödeyenlerin oranı), sağda Ödedi / Bekliyor / Ödemedi sayıları.
// Oran sadece sakini olan dairelere göre hesaplanır (boş daireler aidat ödemez).
function OzetKarti({ harita, ay, yil }) {
  const { odendi, bekliyor, odenmedi } = harita.ozet;
  const dolu = odendi + bekliyor + odenmedi;
  return (
    <View style={styles.kart}>
      <View style={styles.kartUst}>
        <Text style={yazilar.etiket}>{`${AY_ADLARI[ay - 1]} ${yil} aidatı`.toLocaleUpperCase('tr-TR')}</Text>
        <Text style={styles.soluk}>{dolu} dolu daire</Text>
      </View>
      <View style={styles.ozetGovde}>
        <Gosterge oran={dolu === 0 ? 0 : odendi / dolu} />
        <View style={styles.ozetListe}>
          {[
            ['odendi', odendi],
            ['bekliyor', bekliyor],
            ['odenmedi', odenmedi],
          ].map(([d, n]) => (
            <View key={d} style={styles.ozetSatir}>
              <Ikon ad={DURUMLAR[d].ikon} boyut={17} renk={DURUMLAR[d].renk} />
              <Text style={styles.ozetAd}>{DURUMLAR[d].ad}</Text>
              <Text style={styles.ozetSayi}>{n}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Mini harita: ilk 16 dairenin bu ayki durumu, 4 sütunluk küçük kareler (ince renk tonu + çerçeve).
function MiniHarita({ harita }) {
  const daireler = harita.binalar.flatMap((b) => b.daireler).slice(0, 16);
  // 4'erli satırlara bölünür; son satır eksikse boş yer tutucularla tamamlanır ki kareler hizalı kalsın.
  const satirlar = [];
  for (let i = 0; i < daireler.length; i += 4) satirlar.push(daireler.slice(i, i + 4));
  return (
    <View style={styles.mini}>
      {satirlar.map((satir, s) => (
        <View key={s} style={styles.miniSatir}>
          {[0, 1, 2, 3].map((i) => {
            const d = satir[i];
            if (!d) return <View key={i} style={styles.miniKareBos} />;
            const renk = DURUMLAR[d.durum].renk;
            return (
              <View
                key={d.id}
                style={[
                  styles.miniKare,
                  d.durum === 'bos'
                    ? { borderColor: renkler.kenarlik }
                    : { backgroundColor: karistir(renk, 0.26), borderColor: karistir(renk, 0.6) },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Kurulum yapılmadıysa: 3 adımlı yol haritası ve iki buton (kurulum, aidat tutarı)
function KurulumOncesi({ navigation, aidatTutari }) {
  const adimlar = [
    ['Binaları ve daireleri oluşturun', 'Her daireye 6 haneli davet kodu verilir.'],
    ['Aylık aidat tutarını belirleyin', 'Sakinlerin formunda hazır gelir.'],
    ['Davet kodlarını paylaşın', 'Sakinler kodla katılır.'],
  ];
  return (
    <>
      <View style={styles.adimlar}>
        {adimlar.map(([baslik, alt], i) => (
          <View key={baslik} style={[styles.adim, i > 0 && styles.adimCizgi]}>
            <View style={[styles.adimNo, i === 0 && styles.adimNoAktif]}>
              <Text style={[styles.adimNoYazi, i === 0 && { color: renkler.zumrutUzeri }]}>{i + 1}</Text>
            </View>
            <View style={styles.adimMetin}>
              <Text style={[styles.adimBaslik, i > 0 && { color: renkler.soluk, fontWeight: '500' }]}>{baslik}</Text>
              <Text style={styles.soluk}>{alt}</Text>
            </View>
          </View>
        ))}
      </View>
      {/* "Bina ve daire kurulumu" butonu: basınca Kurulum ekranına geçilir */}
      <Buton baslik="Bina ve daire kurulumu" ikon="kurulum" onPress={() => navigation.navigate('Kurulum')} />
      {/* "Aidat tutarını belirle" butonu: basınca AidatTutari ekranı açılır */}
      <Buton
        baslik={aidatTutari == null ? 'Aidat tutarını belirle' : 'Aidat tutarını değiştir'}
        ikon="lira"
        tur="ikincil"
        onPress={() => navigation.navigate('AidatTutari', { aidatTutari })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  // paddingTop: üst çubuk olmadığı için durum çubuğunun altından başlar
  icerik: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 28,
    gap: 12,
  },
  yukleniyor: {
    marginVertical: 40,
  },
  selamBlok: {
    gap: 2,
    marginBottom: 4,
  },
  selam: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    color: renkler.soluk,
  },
  siteAd: {
    fontFamily: yaziTipi.metin,
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: renkler.yazi,
  },
  siteMeta: {
    marginTop: 6,
  },
  soluk: {
    fontFamily: yaziTipi.metin,
    fontSize: 13,
    color: renkler.soluk,
  },
  kart: {
    padding: 16,
    gap: 10,
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
  ozetGovde: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ozetListe: {
    flex: 1,
    gap: 9,
  },
  ozetSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ozetAd: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 13.5,
    color: renkler.yazi,
  },
  ozetSayi: {
    fontFamily: yaziTipi.mono,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  // Bento satırı: iki kutu yan yana, eşit genişlikte
  satir: {
    flexDirection: 'row',
    gap: 10,
  },
  sutun: {
    flex: 1,
    flexBasis: 0,
    gap: 10,
  },
  mini: {
    gap: 4,
  },
  miniSatir: {
    flexDirection: 'row',
    gap: 4,
  },
  // Her satırda 4 eşit kare (flex: 1 genişliği paylaştırır, aspectRatio yüksekliği genişliğe eşitler)
  miniKare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 2,
    borderWidth: 1,
  },
  miniKareBos: {
    flex: 1,
  },
  adimlar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  adim: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  adimCizgi: {
    borderTopWidth: 1,
    borderTopColor: renkler.kenarlik,
    borderStyle: 'dashed',
  },
  adimNo: {
    width: 26,
    height: 26,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adimNoAktif: {
    backgroundColor: renkler.zumrutDolgu,
  },
  adimNoYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: renkler.soluk,
  },
  adimMetin: {
    flex: 1,
  },
  adimBaslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
});
