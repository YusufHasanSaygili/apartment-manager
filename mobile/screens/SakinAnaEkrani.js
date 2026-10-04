// Sakin ana ekranı: sakin giriş yapınca açılan ekran.
// Üstte site adı ve daire kartı (daire adı + bu ayın aidat durumu), altında 2'li ızgarada (bento) işlemler:
// aidat bildirimi gönder (altın, geniş), aidat takvimim (mini takvimli, uzun), duyurular ve yöneticiye mesaj.
// Altta sakinin son aidat bildirimleri ve en altta hesap kartı (çıkış, hesap silme).
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import HataMesaji from '../components/HataMesaji';
import HesapKarti from '../components/HesapKarti';
import Kutu from '../components/Kutu';
import { DURUMLAR, DurumRozeti } from '../components/Durum';
import { AY_ADLARI, ayAdi, goreliGun, paraBicimi } from '../bicim';
import { karistir, kose, renkler, yaziTipi, yazilar } from '../tema';

// Bildirim durumu → rozetin rengi (Durum.js'teki durum) ve yazısı
const BILDIRIM = {
  bekliyor: { durum: 'bekliyor', yazi: 'Onay bekliyor' },
  onaylandi: { durum: 'odendi', yazi: 'Ödendi' },
  reddedildi: { durum: 'odenmedi', yazi: 'Reddedildi' },
};
const YONTEMLER = { banka: 'Banka havalesi', elden: 'Elden' };
// Mini takvimdeki ay baş harfleri (Ocak … Aralık)
const BAS_HARF = ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'];

// navigation: aidat bildirimi, takvim, duyurular, sohbet ve hesap silme ekranlarına geçmek için kullanılır.
export default function SakinAnaEkrani({ navigation }) {
  const { oturum } = useOturum();
  // useState: ekranın verisi { benim, aylar, yonetici, yeniDuyuru }. null → henüz yüklenmedi.
  const [veri, setVeri] = useState(null);
  // useState: veri yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  const simdi = new Date();
  const ay = simdi.getMonth() + 1;
  const yil = simdi.getFullYear();

  // API istekleri (aynı anda): GET /api/aidatlar/benim (son bildirimler, aidat tutarı), GET /api/aidatlar/takvim
  // (bu yılın ayları: bu ayın durumu ve mini takvim), GET /api/mesajlar/sohbetler (yöneticinin adı, okunmamış mesaj),
  // GET /api/duyurular (bugün gelen duyuru sayısı).
  // useCallback: yukle her çizimde yeniden oluşturulmaz; useFocusEffect ona bağlı olduğu için gereksiz istek atılmaz.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const [benim, takvim, sohbetler, duyurular] = await Promise.all([
        api.get('/aidatlar/benim'),
        api.get('/aidatlar/takvim', { params: { yil } }),
        api.get('/mesajlar/sohbetler'),
        api.get('/duyurular'),
      ]);
      setVeri({
        benim: benim.data,
        aylar: takvim.data.aylar,
        yonetici: sohbetler.data[0] ?? null,
        yeniDuyuru: duyurular.data.filter((d) => goreliGun(d.tarih) === 'Bugün').length,
      });
    } catch (e) {
      setHata(e.message);
    }
  }, [yil]);

  // useFocusEffect: ekran her öne geldiğinde veri yenilenir; bildirim gönderip veya mesaj okuyup dönünce güncel olur.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle]),
  );

  // Takvimdeki durumu ekrana çevirir: gelecek ayların "ödenmedi"si "henüz gelmedi", katılmadan önceki aylar "once"
  const ayDurumu = (a) => (a.durum === 'odenmedi' && a.ay > ay ? 'gelecek' : a.durum === 'bos' ? 'once' : a.durum);
  const buAy = veri ? ayDurumu(veri.aylar[ay - 1]) : null;
  const buAyYazi = { odendi: 'Ödendi', bekliyor: 'Onay bekliyor', odenmedi: 'Ödenmedi', once: 'Henüz katılmadınız' }[buAy];

  return (
    // ScrollView: içerik ekrana sığmazsa sayfa kaydırılır.
    <ScrollView style={styles.dis} contentContainerStyle={styles.icerik}>
      <View style={styles.selamBlok}>
        <Text style={styles.selam}>Hoş geldin, {oturum.kullanici.ad}</Text>
        <Text style={styles.siteAd}>{oturum.site.ad}</Text>
      </View>

      {/* Daire kartı: solda daire adı (büyük, mono), sağda bu ayın aidat durumu ("EKİM" zümrüt renkte) */}
      <View style={styles.kart}>
        <View style={styles.daireKart}>
          <View>
            <Text style={yazilar.etiket}>DAİRENİZ</Text>
            {/* daire normalde hep doludur; sunucu dairenin kaydını bulamazsa null gelir, o durumda çizgi gösterilir */}
            <Text style={styles.daireBuyuk}>{oturum.daire?.ad ?? '—'}</Text>
          </View>
          {buAy && buAyYazi && (
            <View style={styles.buAy}>
              <Text style={yazilar.etiket}>
                <Text style={{ color: renkler.zumrut }}>{AY_ADLARI[ay - 1].toLocaleUpperCase('tr-TR')}</Text> AİDATI
              </Text>
              <DurumRozeti durum={buAy === 'once' ? 'gelecek' : buAy} yazi={buAyYazi} />
            </View>
          )}
        </View>
      </View>

      {hata !== '' ? (
        // Hata olursa "Tekrar dene" ile yukle yeniden çalışır
        <HataMesaji mesaj={hata} tekrarDene={yukle} />
      ) : veri === null ? (
        <ActivityIndicator color={renkler.birincil} style={styles.yukleniyor} />
      ) : (
        <>
          {/* "Aidat bildirimi gönder": geniş altın kutu; basınca AidatBildir açılır, yöneticinin belirlediği tutar
              da gönderilir ki formda hazır gelsin */}
          <Kutu
            genis
            vurgulu
            ikon="aidatGonder"
            baslik="Aidat bildirimi gönder"
            alt="Ödediğinizi yöneticiye bildirin"
            onPress={() => navigation.navigate('AidatBildir', { aidatTutari: veri.benim.aidatTutari })}
          />
          <View style={styles.satir}>
            <View style={styles.sutun}>
              {/* "Aidat takvimim" (uzun, mini takvimli): basınca AidatTakvimi açılır (sakinin kendi dairesi) */}
              <Kutu ikon="takvim" baslik="Aidat takvimim" alt={String(yil)} onPress={() => navigation.navigate('AidatTakvimi')}>
                <MiniTakvim aylar={veri.aylar.map(ayDurumu)} buAy={ay} />
              </Kutu>
            </View>
            <View style={styles.sutun}>
              {/* "Duyurular": basınca duyuru listesi açılır; rozet bugün gelen duyuru sayısı */}
              <Kutu
                ikon="duyuru"
                baslik="Duyurular"
                alt={veri.yeniDuyuru > 0 ? `${veri.yeniDuyuru} yeni duyuru` : 'Sitenin duyuruları'}
                rozet={veri.yeniDuyuru > 0 ? String(veri.yeniDuyuru) : null}
                onPress={() => navigation.navigate('Duyurular')}
              />
              {/* "Yöneticiye mesaj gönder": basınca Sohbet açılır; sakin sadece sitenin yöneticisiyle yazışabilir */}
              <Kutu
                ikon="mesaj"
                baslik="Yöneticiye mesaj gönder"
                alt={veri.yonetici?.ad ?? 'Site yöneticisi'}
                rozet={veri.yonetici?.okunmamis > 0 ? String(veri.yonetici.okunmamis) : null}
                onPress={() => navigation.navigate('Sohbet', { baslik: veri.yonetici ? `${veri.yonetici.ad} · Yönetici` : undefined })}
              />
            </View>
          </View>

          <Text style={[yazilar.etiket, styles.bolum]}>SON BİLDİRİMLERİM</Text>
          {veri.benim.bildirimler.length === 0 && <Text style={yazilar.aciklama}>Henüz bildirim göndermediniz.</Text>}
          {veri.benim.bildirimler.map((b) => {
            const d = BILDIRIM[b.durum];
            const reddedildi = b.durum === 'reddedildi';
            return (
              // Reddedilen bildirime basınca o ay için formu yeniden açar (ay ve yıl hazır gelir); diğerleri basılamaz.
              <Pressable
                key={b.id}
                style={({ pressed }) => [styles.kart, styles.bildirim, pressed && styles.basili]}
                disabled={!reddedildi}
                onPress={() => navigation.navigate('AidatBildir', { aidatTutari: veri.benim.aidatTutari, ay: b.ay, yil: b.yil })}
                accessibilityRole={reddedildi ? 'button' : undefined}
                accessibilityHint={reddedildi ? 'Bu ay için yeniden bildirim gönderir' : undefined}
              >
                <View style={styles.bildirimUst}>
                  <Text style={styles.bildirimAy}>{ayAdi(b.ay, b.yil)}</Text>
                  <DurumRozeti durum={d.durum} yazi={d.yazi} />
                </View>
                <Text style={styles.soluk}>
                  {paraBicimi(b.tutar)} · {YONTEMLER[b.odemeYontemi]}
                  {b.aciklama !== '' ? ` · “${b.aciklama}”` : ''}
                </Text>
                {reddedildi && <Text style={styles.tekrar}>Tekrar göndermek için dokunun ›</Text>}
              </Pressable>
            );
          })}
        </>
      )}

      {/* Hesap kartı: Çıkış yap ve Hesabımı sil */}
      <HesapKarti navigation={navigation} rol={`Sakin${oturum.daire ? ` · ${oturum.daire.ad}` : ''}`} />
    </ScrollView>
  );
}

// Mini takvim: yılın 12 ayı, 4 sütunlu küçük kutularda ay baş harfleriyle. Ödenen ay yeşil, bekleyen sarı halka,
// ödenmeyen kırmızı; katılmadan önceki aylar soluk.
function MiniTakvim({ aylar, buAy }) {
  return (
    <View style={styles.mini}>
      {[0, 1, 2].map((s) => (
        <View key={s} style={styles.miniSatir}>
          {aylar.slice(s * 4, s * 4 + 4).map((durum, i) => {
            const no = s * 4 + i;
            const renkli = ['odendi', 'bekliyor', 'odenmedi'].includes(durum);
            const renk = DURUMLAR[durum].renk;
            return (
              <View
                key={no}
                style={[
                  styles.miniKare,
                  renkli && { backgroundColor: karistir(renk, 0.14), borderColor: renk, borderWidth: 1.5 },
                  durum === 'once' && { opacity: 0.45 },
                  no + 1 === buAy && !renkli && { borderColor: renkler.kenarlikGuclu },
                ]}
              >
                <Text style={[styles.miniHarf, renkli && { color: renk }]}>{BAS_HARF[no]}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
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
  kart: {
    padding: 16,
    gap: 8,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  daireKart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  daireBuyuk: {
    marginTop: 6,
    fontFamily: yaziTipi.mono,
    fontSize: 50,
    fontWeight: '600',
    lineHeight: 54,
    letterSpacing: -2,
    color: renkler.yazi,
  },
  buAy: {
    alignItems: 'flex-end',
    gap: 6,
  },
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
  miniKare: {
    flex: 1,
    flexBasis: 0,
    aspectRatio: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniHarf: {
    fontFamily: yaziTipi.mono,
    fontSize: 10,
    color: renkler.soluk,
  },
  bolum: {
    marginTop: 6,
  },
  bildirim: {
    gap: 6,
  },
  basili: {
    opacity: 0.75,
  },
  bildirimUst: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bildirimAy: {
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  soluk: {
    fontFamily: yaziTipi.metin,
    fontSize: 13,
    color: renkler.soluk,
  },
  tekrar: {
    fontFamily: yaziTipi.metin,
    fontSize: 13,
    fontWeight: '600',
    color: renkler.birincil,
  },
});
