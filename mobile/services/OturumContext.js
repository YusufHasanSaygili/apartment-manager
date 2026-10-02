// Oturum bilgisi (token, kullanıcı, site) tüm uygulamayla paylaşılır.
// React Context: bir veriyi her ekrana tek tek prop olarak geçmek yerine, uygulamanın
// her yerinden useOturum() ile okunabilir hale getirir. App.js oturum varsa yönetici
// ekranını, yoksa açılış ekranını göstermek için bunu kullanır.
import { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { tokenAyarla } from './api';

// Token telefonda bu anahtar adıyla saklanır.
const TOKEN_ANAHTARI = 'oturumToken';

const OturumContext = createContext(null);

export function OturumProvider({ children }) {
  // useState: giriş yapan kullanıcının bilgileri ({ token, kullanici, site }).
  // null → giriş yapılmamış. Değişince App.js ekranları otomatik olarak değiştirir.
  const [oturum, setOturum] = useState(null);

  // useState: açılışta kayıtlı token kontrol edilirken false. Kontrol bitmeden ekran
  // seçilmez; yoksa giriş yapmış kullanıcı bir an açılış ekranını görürdü.
  const [hazir, setHazir] = useState(false);

  // useEffect: uygulama ilk açıldığında bir kez çalışır → otomatik giriş.
  // Telefonda kayıtlı token varsa GET /api/hesap/ben ile hâlâ geçerli mi diye sorulur.
  useEffect(() => {
    const kayitliOturumuYukle = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_ANAHTARI);
        if (token) {
          tokenAyarla(token);
          const { data } = await api.get('/hesap/ben');
          setOturum({ token, ...data });
        }
      } catch (hata) {
        // 401: token süresi dolmuş veya hesap silinmiş → kayıtlı token silinir.
        // Ağ hatasında token silinmez; internet gelince bir sonraki açılışta tekrar denenir.
        tokenAyarla(null);
        if (hata.durumKodu === 401) {
          await SecureStore.deleteItemAsync(TOKEN_ANAHTARI);
        }
      } finally {
        setHazir(true);
      }
    };
    kayitliOturumuYukle();
  }, []);

  // Sunucudan gelen giriş/kayıt cevabıyla oturumu açar.
  // Token expo-secure-store ile telefonun şifreli deposuna yazılır (AsyncStorage değil):
  // başka uygulamalar okuyamaz. Ayrıca sonraki tüm API isteklerine eklenir.
  const oturumAc = async ({ token, kullanici, site }) => {
    await SecureStore.setItemAsync(TOKEN_ANAHTARI, token);
    tokenAyarla(token);
    setOturum({ token, kullanici, site });
  };

  // Çıkış: token telefondan ve isteklerden silinir, oturum boşaltılır →
  // App.js otomatik olarak açılış ekranına döner.
  const cikisYap = async () => {
    await SecureStore.deleteItemAsync(TOKEN_ANAHTARI);
    tokenAyarla(null);
    setOturum(null);
  };

  // Provider: içine sarılan tüm ekranlara oturum bilgisini ve fonksiyonları dağıtır.
  return (
    <OturumContext.Provider value={{ oturum, hazir, oturumAc, cikisYap }}>{children}</OturumContext.Provider>
  );
}

// Ekranların oturum bilgisine ulaşmak için kullandığı kısa yol: const { oturum } = useOturum();
export function useOturum() {
  return useContext(OturumContext);
}
