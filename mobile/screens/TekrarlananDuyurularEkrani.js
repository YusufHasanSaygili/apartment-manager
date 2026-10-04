// Tekrarlayan duyurular ekranı (yönetici): belirli gün(ler)de ve saatte kendiliğinden yayınlanacak duyuruları
// ekler ve siler ("Her pazartesi 08:00 — Çöp günü"). Vakti gelince duyuru, duyurular listesine düşer ve
// sitedeki herkese bildirim gider. Üstte ekleme formu, altta mevcut tekrarlayan duyuruların listesi vardır.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
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
import Ikon from '../components/Ikon';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

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
  // saat ve dakika ayrı kutularda elle yazılır ("08" : "00").
  const [saatKutu, setSaatKutu] = useState('08');
  const [dakikaKutu, setDakikaKutu] = useState('00');
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
  // Saat ve dakika iki ayrı kutudan alınıp "08:30" biçiminde birleştirilir; düzenli ifade (regex: metnin belli bir kalıba uyup uymadığını kontrol eden desen)
  // ile saat 0–23, dakika 0–59 olduğu kontrol edilir. Desenin parçaları:
  //   ^ ve $ → metnin tamamı kalıba uymalı (başında/sonunda fazlalık olamaz)
  //   ([01]?\d|2[0-3]) → saat: 0–19 ("8", "08", "19") veya 20–23
  //   :([0-5]\d) → iki nokta, ardından dakika: 00–59 (her zaman iki hane)
  // exec: uyarsa parantez içindeki kısımları verir (eslesme[1] = saat, eslesme[2] = dakika), uymazsa null döner.
  const ekle = async () => {
    // İki kutudaki değerler "08:30" biçiminde birleştirilir (dakika tek haneliyse başına 0 eklenir).
    const eslesme = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(`${saatKutu}:${dakikaKutu.padStart(2, '0')}`);
    if (baslik.trim().length < 2 || !icerik.trim()) return setFormHatasi('Başlık (en az 2 karakter) ve içerik girin.');
    if (secilenGunler.length === 0) return setFormHatasi('En az bir gün seçin.');
    if (!eslesme) return setFormHatasi('Saati 0–23, dakikayı 0–59 arasında girin.');

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
      <Text style={[yazilar.aciklama, styles.aciklama]}>
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

      <Text style={[yazilar.etiket, styles.etiket]}>GÜNLER</Text>
      {/* 7 gün tek satırda, eşit genişlikte (flex: 1) */}
      <View style={styles.gunler}>
        {GUNLER.map((g) => {
          const secili = secilenGunler.includes(g.deger);
          return (
            // Gün düğmesi: basınca gunDegistir çalışır, gün seçilir veya seçimden çıkarılır (seçiliyse dolu renkli).
            <SecimDugmesi key={g.deger} yazi={g.kisa} secili={secili} coklu style={styles.gun} onPress={() => gunDegistir(g.deger)} />
          );
        })}
      </View>

      {/* Saat elle yazılır: iki kutu (saat : dakika), sadece rakam, en fazla 2 hane */}
      <Text style={[yazilar.etiket, styles.etiket]}>SAAT</Text>
      <View style={styles.saatSatir}>
        <TextInput
          style={styles.saatKutu}
          value={saatKutu}
          onChangeText={(m) => setSaatKutu(m.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          accessibilityLabel="Saat"
        />
        <Text style={styles.ikiNokta}>:</Text>
        <TextInput
          style={styles.saatKutu}
          value={dakikaKutu}
          onChangeText={(m) => setDakikaKutu(m.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          accessibilityLabel="Dakika"
        />
        <Text style={[yazilar.aciklama, styles.saatNot]}>{'saat : dakika\nTürkiye saati'}</Text>
      </View>

      {formHatasi !== '' && <HataMesaji mesaj={formHatasi} />}
      {/* "Ekle" butonu: basınca ekle çalışır ve tekrarlayan duyuru backend'e kaydedilir */}
      <Buton baslik="Ekle" ikon="ekle" onPress={ekle} yukleniyor={ekleniyor} />

      <Text style={[yazilar.etiket, styles.listeBaslik]}>KAYITLI</Text>
      {/* Liste hatasında "Tekrar dene" butonu yukle'yi yeniden çalıştırır */}
      {listeHatasi !== '' && <HataMesaji mesaj={listeHatasi} tekrarDene={yukle} />}
      {liste === null && listeHatasi === '' && <ActivityIndicator color={renkler.birincil} />}
      {liste?.length === 0 && <Text style={styles.bos}>Henüz tekrarlayan duyuru yok.</Text>}
      {liste?.map((t) => (
        <View key={t.id} style={styles.kart}>
          <View style={styles.kartUst}>
            <View style={styles.zamanSatir}>
              <Ikon ad="tekrar" boyut={16} renk={renkler.birincil} />
              <Text style={styles.zaman}>
                {gunMetni(t.gunler)} · {saatMetni(t.saat, t.dakika)}
              </Text>
            </View>
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
    padding: 18,
    gap: 4,
  },
  aciklama: {
    marginBottom: 16,
  },
  uzunAlan: {
    minHeight: 100,
    textAlignVertical: 'top', // Android'de yazı kutunun üstünden başlasın
  },
  etiket: {
    marginBottom: 7,
  },
  gunler: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  // Gün düğmesi: 7 düğme satırı eşit paylaşır (minWidth ve yan boşluk sıfırlanır ki dar ekranda sığsın)
  gun: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  saatSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  saatKutu: {
    width: 72,
    height: 52,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
    textAlign: 'center',
    fontFamily: yaziTipi.mono,
    fontSize: 22,
    fontWeight: '600',
    color: renkler.yazi,
  },
  ikiNokta: {
    fontFamily: yaziTipi.mono,
    fontSize: 22,
    fontWeight: '600',
    color: renkler.soluk,
  },
  saatNot: {
    marginLeft: 6,
    fontSize: 12,
    lineHeight: 16,
  },
  listeBaslik: {
    marginTop: 20,
    marginBottom: 8,
  },
  bos: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
  kart: {
    marginBottom: 12,
    padding: 16,
    gap: 6,
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
  zamanSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zaman: {
    fontFamily: yaziTipi.mono,
    fontSize: 13.5,
    fontWeight: '600',
    color: renkler.birincil,
  },
  kartBaslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 17,
    fontWeight: '600',
    color: renkler.yazi,
  },
  kartMetin: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    lineHeight: 20,
    color: renkler.soluk,
  },
  son: {
    fontFamily: yaziTipi.metin,
    fontSize: 13,
    color: renkler.sonuk,
  },
});
