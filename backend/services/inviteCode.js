// Davet kodu üretme: hem ilk kurulum (tüm daireler) hem sakin daireden çıkarılınca (o daireye yeni kod) kullanır.
const crypto = require('node:crypto');

// count kadar, birbirinden farklı 6 haneli davet kodu üretir (örn. "048213").
// crypto.randomInt: tahmin edilemeyen (kriptografik) rastgele sayı; Math.random tahmin edilebilir.
// Set: aynı kod iki kez üretilirse ikincisi eklenmez, döngü yenisini üretir.
function generateInviteCodes(count) {
  const codes = new Set();
  while (codes.size < count) {
    codes.add(String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'));
  }
  return [...codes];
}

module.exports = { generateInviteCodes };
