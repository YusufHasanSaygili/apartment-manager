// Oturum bilgisi (token, kullanıcı, site) tüm uygulamayla paylaşılır.
// React Context: bir veriyi her ekrana tek tek prop olarak geçmek yerine, uygulamanın
// her yerinden useOturum() ile okunabilir hale getirir. App.js oturum varsa yönetici
// ekranını, yoksa açılış ekranını göstermek için bunu kullanır.
import { createContext, useContext, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// Token telefonda bu anahtar adıyla saklanır.
const TOKEN_ANAHTARI = 'oturumToken';

const OturumContext = createContext(null);

export function OturumProvider({ children }) {
  // useState: giriş yapan kullanıcının bilgileri ({ token, kullanici, site }).
  // null → giriş yapılmamış. Değişince App.js ekranları otomatik olarak değiştirir.
  const [oturum, setOturum] = useState(null);

  // Sunucudan gelen giriş/kayıt cevabıyla oturumu açar.
  // Token expo-secure-store ile telefonun şifreli deposuna yazılır (AsyncStorage değil):
  // başka uygulamalar okuyamaz. Kayıtlı token ile otomatik giriş Görev 1.2'de eklenecek.
  const oturumAc = async ({ token, kullanici, site }) => {
    await SecureStore.setItemAsync(TOKEN_ANAHTARI, token);
    setOturum({ token, kullanici, site });
  };

  // Provider: içine sarılan tüm ekranlara oturum bilgisini ve oturumAc fonksiyonunu dağıtır.
  return <OturumContext.Provider value={{ oturum, oturumAc }}>{children}</OturumContext.Provider>;
}

// Ekranların oturum bilgisine ulaşmak için kullandığı kısa yol: const { oturum } = useOturum();
export function useOturum() {
  return useContext(OturumContext);
}
