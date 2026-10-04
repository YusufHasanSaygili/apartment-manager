// Aidat takvimi ekranı: bir dairenin seçilen yıldaki 12 ayının aidat durumunu 2 sütunlu kutularda gösterir.
// Yönetici haritada bir daireye dokununca açılır (route'ta daireId gelir); sakin kendi ana ekranından açar
// (daireId gelmez → sunucu sakinin kendi dairesini döner). Kutuların hepsi aynı yükseklikte; solda durum ikonu,
// sağda ay adı ve durum. Henüz gelmemiş aylarda takvimin etrafındaki ok döner.
// Yönetici, ödenmemiş bir aya dokunarak o ayı elle "ödendi" işaretleyebilir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import HataMesaji from '../components/HataMesaji';
import { useYenileme } from '../components/Yenileme';
import SayfaSecici from '../components/SayfaSecici';
import { AyKutusu } from '../components/Durum';
import { AY_ADLARI } from '../bicim';
import { renkler, yazilar } from '../tema';

// route.params: { daireId, daireAdi } (yönetici) veya boş (sakin)
export default function AidatTakvimiEkrani({ route }) {
  const daireId = route.params?.daireId;
  // Yönetici mi bakıyor: daireId geldiyse evet. Hangi adrese istek atılacağını ve elle işaretlemeyi belirler.
  const yonetici = Boolean(daireId);
  const { oturum } = useOturum();

  const bugun = new Date();
  const buYil = bugun.getFullYear();
  // Bugünün ay sırası (yıl × 12 + ay): bundan sonraki ödenmemiş aylar "Henüz gelmedi" gösterilir.
  const buAySirasi = buYil * 12 + bugun.getMonth() + 1;

  // useState: gösterilen yıl. Oklarla değişir; değişince takvim o yıl için yeniden istenir.
  const [yil, setYil] = useState(buYil);
  // useState: 12 ayın listesi [{ ay, durum, odemeYontemi }]. null → yükleniyor.
  const [aylar, setAylar] = useState(null);
  // useState: takvim yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // useRef: son isteğin numarası; oklara hızlı basılınca eski yılın geç gelen cevabı ekrana yazılmasın diye.
  const sonIstek = useRef(0);

  // API isteği: yönetici için GET /api/yonetim/aidatlar/takvim/:daireId?yil=, sakin için GET /api/aidatlar/takvim?yil=
  // → seçilen yılın 12 ayı ve her ayın durumu.
  // useCallback: yukle sadece daire veya yıl değişince yeniden oluşur; aşağıdaki useEffect de o zaman tekrar çalışır.
  const yukle = useCallback(async () => {
    const no = ++sonIstek.current;
    setHata('');
    try {
      const adres = yonetici ? `/yonetim/aidatlar/takvim/${daireId}` : '/aidatlar/takvim';
      const { data } = await api.get(adres, { params: { yil } });
      if (no === sonIstek.current) setAylar(data.aylar);
    } catch (e) {
      if (no === sonIstek.current) setHata(e.message);
    }
  }, [yonetici, daireId, yil]);

  // useEffect: ekran açılınca ve yıl değişince takvimi yükler.
  useEffect(() => {
    yukle();
  }, [yukle]);

  // Ok butonları yılı değiştirir; eski yılın takvimi yeni yıl yüklenene kadar görünmesin diye aylar temizlenir.
  // (Aşağı çekip yenilemede ve elle işaretlemeden sonra temizlenmez; takvim yerinde kalıp güncellenir.)
  const yilDegistir = (fark) => {
    setAylar(null);
    setYil((y) => y + fark);
  };

  // Aşağı çekip yenileme: sayfa en üstteyken aşağı çekilince yukle tekrar çalışır (components/Yenileme.js).
  const yenileme = useYenileme(yukle);

  // Elle işaretleme (sadece yönetici): önce onay sorulur; "İşaretle" seçilirse POST /api/yonetim/aidatlar/elle
  // isteğiyle o ay ödendi sayılır ve takvim yeniden yüklenir.
  const elleIsaretle = (ay) =>
    Alert.alert(
      'Ödendi olarak işaretle',
      `${route.params.daireAdi} dairesinin ${AY_ADLARI[ay - 1]} ${yil} aidatı ödendi olarak işaretlensin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İşaretle',
          onPress: async () => {
            try {
              await api.post('/yonetim/aidatlar/elle', { daireId, ay, yil });
              yukle();
            } catch (e) {
              Alert.alert('İşaretlenemedi', e.message);
            }
          },
        },
      ],
    );

  // Sunucudan gelen durumu ekrandaki duruma çevirir: gelecek ayların "ödenmedi"si "henüz gelmedi" olur;
  // sakin kendi takviminde "sakin yok" yerine "katılmadan önce" görür.
  const ekranDurumu = (a) => {
    if (a.durum === 'odenmedi' && yil * 12 + a.ay > buAySirasi) return 'gelecek';
    if (a.durum === 'bos' && !yonetici) return 'once';
    return a.durum;
  };

  const enSonYil = buYil + 1;
  const enEskiYil = buYil - 5;
  // Ayları 2'li satırlara böler (2 sütunlu ızgara)
  const satirlar = aylar ? Array.from({ length: 6 }, (_, i) => aylar.slice(i * 2, i * 2 + 2)) : [];

  return (
    <ScrollView style={styles.dis} contentContainerStyle={styles.icerik} refreshControl={yenileme}>
      {/* Yıl seçici: oklarla önceki/sonraki yıl (5 yıl geriye, 1 yıl ileriye kadar) */}
      <SayfaSecici
        baslik={String(yil)}
        alt={yonetici ? `Daire ${route.params.daireAdi}` : oturum.daire ? `Daire ${oturum.daire.ad}` : undefined}
        onOnceki={() => yilDegistir(-1)}
        onSonraki={() => yilDegistir(1)}
        oncekiPasif={yil <= enEskiYil}
        sonrakiPasif={yil >= enSonYil}
        oncekiAdi="Önceki yıl"
        sonrakiAdi="Sonraki yıl"
      />

      {yonetici && <Text style={yazilar.aciklama}>Ödenmemiş bir aya dokunarak elle “ödendi” işaretleyebilirsiniz.</Text>}

      {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve takvim yeniden istenir */}
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {aylar === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}

      {satirlar.map((satir, s) => (
        <View key={s} style={styles.satir}>
          {satir.map((a) => {
            const durum = ekranDurumu(a);
            // Yönetici sadece ödenmemiş, henüz gelmemiş veya sakinsiz ("bos") aylara dokunabilir; ödenmiş ya da
            // onay bekleyen ay tekrar işaretlenemez. Basınca elleIsaretle çalışır.
            const dokunulur = yonetici && (durum === 'odenmedi' || durum === 'gelecek' || durum === 'bos');
            return (
              <AyKutusu
                key={a.ay}
                ad={AY_ADLARI[a.ay - 1]}
                durum={durum}
                alt={a.odemeYontemi === 'yonetici' ? 'Elle işaretlendi' : undefined}
                sira={a.ay}
                onPress={dokunulur ? () => elleIsaretle(a.ay) : undefined}
              />
            );
          })}
        </View>
      ))}
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
    gap: 10,
  },
  satir: {
    flexDirection: 'row',
    gap: 8,
  },
});
