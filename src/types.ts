export interface Question {
  q: string;
  o: string[];
  a: number;
}

export const QDB: Record<number, Question[]> = {
  1: [
    { q: '"GÜZEL" sözcüğünün zıt anlamlısı hangisidir?', o: ['Şirin', 'Çirkin', 'Hoş'], a: 1 },
    { q: '"BÜYÜK" sözcüğünün zıt anlamlısı hangisidir?', o: ['Devasa', 'Uzun', 'Küçük'], a: 2 },
    { q: '"HIZLI" sözcüğünün zıt anlamlısı hangisidir?', o: ['Yavaş', 'Çabuk', 'Yorgun'], a: 0 },
    { q: '"SICAK" sözcüğünün zıt anlamlısı hangisidir?', o: ['Ilık', 'Serin', 'Soğuk'], a: 2 },
    { q: '"AÇIK" sözcüğünün zıt anlamlısı hangisidir?', o: ['Parlak', 'Kapalı', 'Geniş'], a: 1 },
    { q: '"MUTLU" sözcüğünün zıt anlamlısı hangisidir?', o: ['Neşeli', 'Heyecanlı', 'Üzgün'], a: 2 },
    { q: '"UZUN" sözcüğünün zıt anlamlısı hangisidir?', o: ['Kısa', 'İnce', 'Küçük'], a: 0 },
    { q: '"DOLU" sözcüğünün zıt anlamlısı hangisidir?', o: ['Az', 'Boş', 'Yarım'], a: 1 },
    { q: '"CESUR" sözcüğünün zıt anlamlısı hangisidir?', o: ['Güçlü', 'Korkak', 'Akıllı'], a: 1 },
    { q: '"TEMİZ" sözcüğünün zıt anlamlısı hangisidir?', o: ['Kirli', 'Dağınık', 'Eski'], a: 0 },
  ],
  2: [
    { q: 'Sözlükte en ÖNCE gelen hangisidir?', o: ['Bahçe', 'Araba', 'Cadde'], a: 1 },
    { q: 'Sözlükte en SONDA gelen hangisidir?', o: ['Dere', 'Elma', 'Fındık'], a: 2 },
    { q: 'Sözlükte en ÖNCE gelen hangisidir?', o: ['Kalem', 'Defter', 'Kitap'], a: 1 },
    { q: 'Sözlükte en SONDA gelen hangisidir?', o: ['Masa', 'Tahta', 'Sandalye'], a: 1 },
    { q: 'Sözlükte en ÖNCE gelen hangisidir?', o: ['Mavi', 'Kırmızı', 'Sarı'], a: 1 },
    { q: 'Sözlükte en SONDA gelen hangisidir?', o: ['Ağaç', 'Yaprak', 'Orman'], a: 1 },
    { q: 'Sözlükte en ÖNCE gelen hangisidir?', o: ['Yılan', 'Kedi', 'Balık'], a: 2 },
    { q: 'Sözlükte en SONDA gelen hangisidir?', o: ['Güneş', 'Yıldız', 'Ay'], a: 1 },
    { q: 'Sözlükte en ÖNCE gelen hangisidir?', o: ['Uçurtma', 'Top', 'Salıncak'], a: 1 },
    { q: 'Sözlükte en SONDA gelen hangisidir?', o: ['Ev', 'Şehir', 'Köy'], a: 1 },
  ],
  3: [
    { q: '"Ankara" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 0 },
    { q: '"masa" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 1 },
    { q: '"Atatürk" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 0 },
    { q: '"çiçek" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 1 },
    { q: '"Türkiye" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 0 },
    { q: '"araba" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 1 },
    { q: '"İstanbul" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 0 },
    { q: '"köpek" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 1 },
    { q: '"Tuna Nehri" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 0 },
    { q: '"kalem" sözcüğü ne tür bir addır?', o: ['Özel Ad', 'Tür Adı'], a: 1 },
  ],
};
