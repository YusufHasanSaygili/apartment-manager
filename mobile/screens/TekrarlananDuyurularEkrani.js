// Tekrarlayan duyurular ekranı (yönetici): belirli gün(ler)de ve saatte kendiliğinden yayınlanacak duyuruları
// ekler ve siler ("Her pazartesi 08:00 — Çöp günü"). Vakti gelince duyuru, duyurular listesine düşer ve
// sitedeki herkese bildirim gider. Üstte ekleme formu, altta mevcut tekrarlayan duyuruların listesi vardır.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import MetinButonu from '../components/MetinButonu';
// SecimDugmesi: seçilebilir gün düğmesi (ortak component); coklu: birden fazla gün seçilebilir.
import SecimDugmesi from '../components/SecimDugmesi';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { tarihBicimi } from '../bicim';
import { renkler } from '../tema';

// Gün seçim düğmeleri Pazartesi'den başlar (Türkiye'de hafta Pazartesi başlar).
// deger: backend'e giden sayı (JavaScript'teki gibi 0 = Pazar, 1 = Pazartesi ... 6 = Cumartesi).
const GUNLER = [
  { deger: 1, kisa: 'Pzt' },
  { deger: 2, kisa: 'Sal' },
  { deger: 3, kisa: 'Çar' },
  { deger: 4, kisa: 'Per' },
  { deger: 5, kisa: 'Cum' },
  { deger: 6, kisa: 'Cmt' },
  { deger: 0, kisa: 'Paz' },
];

// Seçili günleri okunur metne çevirir: 7 gün → "Her gün", değilse "Pzt, Per" (Pazartesi'den başlayan sırayla).
const gunMetni = (gunler) =>
  gunler.length === 7
    ? 'Her gün'
    : GUNLER.filter((g) => gunler.includes(g.deger))
        .map((g) => g.kisa)
        .join(', ');

// 8, 5 → "08:05" (padStart: tek haneli sayının başına 0 ekler).
const saatMetni = (saat, dakika) => `${String(saat).padStart(2, '0')}:${String(dakika).padStart(2, '0')}`;

export default function TekrarlananDuyurularEkrani() {
  // useState: mevcut tekrarlayan duyurular. null → henüz yüklenmedi.
  const [liste, setListe] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata.
  const [listeHatasi, setListeHatasi] = useState('');

  // useState: form alanları. secilenGunler: seçili günlerin sayıları (örn. [1, 4] → Pazartesi ve Perşembe).
  const [baslik, setBaslik] = useState('');
  const [icerik, setIcerik] = useState('');
  const [secilenGunler, setSecilenGunler] = useState([]);
  const [saat, setSaat] = useState('08:00');
  // useState: ekleme isteği sürerken true (form iki kez gönderilmez) ve formdaki hata mesajı.
  const [ekleniyor, setEkleniyor] = useState(false);
  const [formHatasi, setFormHatasi] = useState('');

  // API isteği: GET /api/tekrarlanan-duyurular ile kendi sitemin tekrarlayan duyurularını çeker.
  // useCallback: fonksiyon her çizimde yeniden oluşmasın diye saklanır; böylece aşağıdaki useFocusEffect gereksiz yere tekrar çalışmaz.
  const yukle = useCallback(async () => {
    setListeHatasi('');
    try {
      const { data } = await api.get('/tekrarlanan-duyurular');
      setListe(data);
    } catch (e) {
      setListeHatasi(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde liste yeniden çekilir ("son gönderim" bilgisi güncellenir).
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle])
  );

  // Bir gün düğmesine basınca o gün seçiliyse çıkarılır, değilse eklenir.
  // Önceki değerden yeni dizi üretilir (filter / [...]); state doğrudan değiştirilmez.
  const gunDegistir = (deger) =>
    setSecilenGunler((onceki) => (onceki.includes(deger) ? onceki.filter((g) => g !== deger) : [...onceki, deger]));

  // ekle: "Ekle" butonuna basınca çalışır. Telefonda kısa kontrol (hızlı geri bildirim), asıl kontrol backend'de.
  // Saat "08:30" biçiminde yazılır; düzenli ifade (regex: metnin belli bir kalıba uyup uymadığını kontrol eden desen)
  // ile saat 0–23, dakika 0–59 olduğu kontrol edilir. Desenin parçaları:
  //   ^ ve $ → metnin tamamı kalıba uymalı (başında/sonunda fazlalık olamaz)
  //   ([01]?\d|2[0-3]) → saat: 0–19 ("8", "08", "19") veya 20–23
  //   :([0-5]\d) → iki nokta, ardından dakika: 00–59 (her zaman iki hane)
  // exec: uyarsa parantez içindeki kısımları verir (eslesme[1] = saat, eslesme[2] = dakika), uymazsa null döner.
  const ekle = async () => {
    const eslesme = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(saat.trim());
    if (baslik.trim().length < 2 || !icerik.trim()) return setFormHatasi('Başlık (en az 2 karakter) ve içerik girin.');
    if (secilenGunler.length === 0) return setFormHatasi('En az bir gün seçin.');
    if (!eslesme) return setFormHatasi('Saati 08:30 biçiminde girin.');

    setFormHatasi('');
    setEkleniyor(true);
    try {
      // API isteği: POST /api/tekrarlanan-duyurular ile yeni tekrarlayan duyuruyu gönderir.
      // Site bilgisi gönderilmez; backend yöneticinin sitesini token'dan bulur.
      const { data } = await api.post('/tekrarlanan-duyurular', {
        baslik,
        icerik,
        gunler: secilenGunler,
        saat: Number(eslesme[1]),
        dakika: Number(eslesme[2]),
      });
      // Başarılı: yeni kayıt listeye eklenir, form temizlenir (saat aynı kalır, art arda eklemek kolay olsun).
      // sort: liste backend'deki gibi saate göre sıralı kalsın (saat × 60 + dakika = günün kaçıncı dakikası).
      setListe((onceki) =>
        [...(onceki ?? []), data].sort((a, b) => a.saat * 60 + a.dakika - (b.saat * 60 + b.dakika))
      );
      setBaslik('');
      setIcerik('');
      setSecilenGunler([]);
    } catch (e) {
      setFormHatasi(e.message);
    } finally {
      setEkleniyor(false);
    }
  };

  // Silme geri alınamaz; önce onay sorulur. Onaylanırsa DELETE /api/tekrarlanan-duyurular/:id isteği atılır
  // ve kayıt listeden çıkarılır. Daha önce yayınlanmış duyurular duyurular listesinde kalır.
  const silOnayi = (t) =>
    Alert.alert('Tekrarlayan duyuruyu sil', `"${t.baslik}" bundan sonra yayınlanmayacak. Silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/tekrarlanan-duyurular/${t.id}`);
            setListe((onceki) => onceki.filter((x) => x.id !== t.id));
          } catch (e) {
            Alert.alert('Silinemedi', e.message);
          }
        },
      },
    ]);

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve buton klavyenin altında kalmaz.
    // Liste en fazla 20 kayıt olduğu için FlatList yerine map ile aynı kaydırılan alana çizilir.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.aciklama}>
        Seçtiğiniz gün ve saatte duyuru kendiliğinden yayınlanır ve herkese bildirim gider (Türkiye saati).
      </Text>

      <FormAlani etiket="Başlık" value={baslik} onChangeText={setBaslik} maxLength={80} placeholder="Örn. Çöp günü" />
      <FormAlani
        etiket="İçerik"
        value={icerik}
        onChangeText={setIcerik}
        maxLength={1000}
        multiline
        style={styles.uzunAlan}
        placeholder="Örn. Çöpler akşam 20.00'de alınacak."
      />

      <Text style={styles.etiket}>Günler</Text>
      <View style={styles.gunler}>
        {GUNLER.map((g) => {
          const secili = secilenGunler.includes(g.deger);
          return (
            // Gün düğmesi: basınca gunDegistir çalışır, gün seçilir veya seçimden çıkarılır (seçiliyse dolu renkli).
            <SecimDugmesi key={g.deger} yazi={g.kisa} secili={secili} coklu onPress={() => gunDegistir(g.deger)} />
          );
        })}
      </View>

      <FormAlani
        etiket="Saat"
        value={saat}
        onChangeText={setSaat}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
        placeholder="08:30"
      />

      {formHatasi !== '' && <HataMesaji mesaj={formHatasi} />}
      {/* "Ekle" butonu: basınca ekle çalışır ve tekrarlayan duyuru backend'e kaydedilir */}
      <Buton baslik="Ekle" onPress={ekle} yukleniyor={ekleniyor} />

      <Text style={styles.listeBaslik}>Tekrarlayan duyurular</Text>
      {/* Liste hatasında "Tekrar dene" butonu yukle'yi yeniden çalıştırır */}
      {listeHatasi !== '' && <HataMesaji mesaj={listeHatasi} tekrarDene={yukle} />}
      {liste === null && listeHatasi === '' && <ActivityIndicator color={renkler.birincil} />}
      {liste?.length === 0 && <Text style={styles.bos}>Henüz tekrarlayan duyuru yok.</Text>}
      {liste?.map((t) => (
        <View key={t.id} style={styles.kart}>
          <View style={styles.kartUst}>
            <Text style={styles.zaman}>
              {gunMetni(t.gunler)} · {saatMetni(t.saat, t.dakika)}
            </Text>
            {/* "Sil" düğmesi: basınca silOnayi çalışır (önce onay sorulur) */}
            <MetinButonu baslik="Sil" tehlike ortada={false} onPress={() => silOnayi(t)} />
          </View>
          <Text style={styles.kartBaslik}>{t.baslik}</Text>
          <Text style={styles.kartMetin}>{t.icerik}</Text>
          <Text style={styles.son}>
            {t.sonGonderim ? `Son gönderim: ${tarihBicimi(t.sonGonderim)}` : 'Henüz gönderilmedi'}
          </Text>
        </View>
      ))}
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
    gap: 4,
  },
  aciklama: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: renkler.soluk,
  },
  uzunAlan: {
    minHeight: 100,
    textAlignVertical: 'top', // Android'de yazı kutunun üstünden başlasın
  },
  etiket: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: renkler.yazi,
  },
  gunler: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  listeBaslik: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  bos: {
    fontSize: 15,
    color: renkler.soluk,
  },
  kart: {
    marginBottom: 12,
    padding: 16,
    gap: 4,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  kartUst: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zaman: {
    fontSize: 14,
    fontWeight: '700',
    color: renkler.birincil,
  },
  kartBaslik: {
    fontSize: 17,
    fontWeight: '700',
    color: renkler.yazi,
  },
  kartMetin: {
    fontSize: 15,
    lineHeight: 22,
    color: renkler.yazi,
  },
  son: {
    fontSize: 13,
    color: renkler.soluk,
  },
});
