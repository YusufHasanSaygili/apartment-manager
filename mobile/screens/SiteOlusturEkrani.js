// Site oluşturma ekranı: yönetici olacak kişi kendi bilgilerini ve site adını girer.
// Gönderince backend yeni siteyi ve yönetici hesabını oluşturur, oturum açılır.
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

export default function SiteOlusturEkrani() {
  // useState: formdaki 4 alanın değerleri. Kullanıcı yazdıkça güncellenir.
  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [siteAdi, setSiteAdi] = useState('');

  // useState: istek sürerken true olur; butonda dönen simge çıkar, form iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);

  // useState: formda veya sunucuda bir hata olursa gösterilecek mesaj.
  const [hata, setHata] = useState('');

  // useOturum: ortak oturum bilgisinden oturumAc fonksiyonunu alır; kayıt başarılı olunca çağrılır.
  const { oturumAc } = useOturum();

  // Form gönderme: önce telefonda basit kontrol, sonra backend'e istek.
  const siteOlustur = async () => {
    // Boş alanı sunucuya hiç göndermeden yakalar (asıl kontrol yine backend'de yapılır).
    if (!ad.trim() || !eposta.trim() || !sifre || !siteAdi.trim()) {
      setHata('Lütfen tüm alanları doldurun.');
      return;
    }
    if (sifre.length < 8) {
      setHata('Şifre en az 8 karakter olmalı.');
      return;
    }

    setHata('');
    setYukleniyor(true);
    try {
      // API isteği: form bilgilerini POST /api/hesap/site-olustur adresine gönderir.
      // Cevapta token, kullanıcı ve site bilgisi gelir.
      const { data } = await api.post('/hesap/site-olustur', { ad, eposta, sifre, siteAdi });
      // Oturum açılınca App.js otomatik olarak yönetici ana ekranına geçer.
      // Bu ekran kapandığı için başarıda yukleniyor'u false yapmaya gerek yok; sadece hatada yapılır.
      await oturumAc(data);
    } catch (e) {
      // Hata mesajı services/api.js tarafından hazırlanmıştır (örn. "Bu e-posta ... zaten bir hesap var").
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca sayfayı dokunulan alana otomatik kaydırır;
    // böylece yazılan alan klavyenin altında kalmaz. bottomOffset: alanla klavye arasında bırakılan boşluk;
    // 100 verildi ki son alana dokununca altındaki "Devam et" butonu da klavyenin üstünde görünsün.
    // keyboardShouldPersistTaps: klavye açıkken butona tek dokunuşla basılabilsin.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.aciklama}>
        Siteyi oluşturan kişi sitenin yöneticisi olur. Daireler bir sonraki adımda eklenecek.
      </Text>

      <FormAlani etiket="Adınız Soyadınız" value={ad} onChangeText={setAd} autoComplete="name" />
      <FormAlani
        etiket="E-posta"
        value={eposta}
        onChangeText={setEposta}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {/* secureTextEntry: şifre yazılırken karakterler gizlenir */}
      <FormAlani
        etiket="Şifre (en az 8 karakter)"
        value={sifre}
        onChangeText={setSifre}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <FormAlani etiket="Site / Apartman adı" value={siteAdi} onChangeText={setSiteAdi} />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Devam et" butonu: basınca siteOlustur çalışır ve form backend'e gönderilir */}
      <Buton baslik="Devam et" onPress={siteOlustur} yukleniyor={yukleniyor} />
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
});
