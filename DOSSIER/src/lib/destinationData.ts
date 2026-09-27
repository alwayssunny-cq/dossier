// ── Shared destination reference data ───────────────────────────────────────
// Used by both /trip/[tripId]/travel-guide (Bon Voyage) and /trip/[tripId]/brief
// (First Steps) so this data and the weather fetch aren't duplicated per page.

export interface CountryReference {
  capital: string
  language: string
  currency: string
  timezone: string
  /** IANA timezone identifier for a representative city — used to compute a real
   *  time-difference-from-viewer, not just display the static UTC offset string above. */
  tz: string
  emergency: string
  adapter: string
  languageCode: string
  coords: [number, number]
}

export const DESTINATION_DATA: Record<string, CountryReference> = {
  'United States':             { capital: 'Washington D.C.', language: 'English',    currency: 'USD ($)',  timezone: 'UTC−5 to −10', tz: 'America/New_York',   emergency: '911',  adapter: 'Type A/B', languageCode: 'en',  coords: [40.71, -74.01] },
  'Australia':                 { capital: 'Canberra',         language: 'English',    currency: 'AUD (A$)', timezone: 'UTC+8 to +11',  tz: 'Australia/Sydney',   emergency: '000',  adapter: 'Type I',   languageCode: 'en',  coords: [-33.87, 151.21] },
  'Japan':                     { capital: 'Tokyo',            language: 'Japanese',   currency: 'JPY (¥)',  timezone: 'UTC+9',         tz: 'Asia/Tokyo',         emergency: '110',  adapter: 'Type A/B', languageCode: 'ja',  coords: [35.68, 139.69] },
  'France':                    { capital: 'Paris',            language: 'French',     currency: 'EUR (€)',  timezone: 'UTC+1/+2',      tz: 'Europe/Paris',       emergency: '112',  adapter: 'Type C/E', languageCode: 'fr',  coords: [48.86, 2.35] },
  'Italy':                     { capital: 'Rome',             language: 'Italian',    currency: 'EUR (€)',  timezone: 'UTC+1/+2',      tz: 'Europe/Rome',        emergency: '112',  adapter: 'Type C/F', languageCode: 'it',  coords: [41.90, 12.50] },
  'Spain':                     { capital: 'Madrid',           language: 'Spanish',    currency: 'EUR (€)',  timezone: 'UTC+1/+2',      tz: 'Europe/Madrid',      emergency: '112',  adapter: 'Type C/F', languageCode: 'es',  coords: [40.42, -3.70] },
  'United Kingdom':            { capital: 'London',           language: 'English',    currency: 'GBP (£)',  timezone: 'UTC+0/+1',      tz: 'Europe/London',      emergency: '999',  adapter: 'Type G',   languageCode: 'en',  coords: [51.51, -0.13] },
  'Germany':                   { capital: 'Berlin',           language: 'German',     currency: 'EUR (€)',  timezone: 'UTC+1/+2',      tz: 'Europe/Berlin',      emergency: '112',  adapter: 'Type C/F', languageCode: 'de',  coords: [52.52, 13.41] },
  'India':                     { capital: 'New Delhi',        language: 'Hindi / English', currency: 'INR (₹)', timezone: 'UTC+5:30',  tz: 'Asia/Kolkata',       emergency: '112',  adapter: 'Type C/D', languageCode: 'hi',  coords: [28.61, 77.21] },
  'Thailand':                  { capital: 'Bangkok',          language: 'Thai',       currency: 'THB (฿)',  timezone: 'UTC+7',         tz: 'Asia/Bangkok',       emergency: '191',  adapter: 'Type A/B', languageCode: 'th',  coords: [13.76, 100.50] },
  'Greece':                    { capital: 'Athens',           language: 'Greek',      currency: 'EUR (€)',  timezone: 'UTC+2/+3',      tz: 'Europe/Athens',      emergency: '112',  adapter: 'Type C/F', languageCode: 'el',  coords: [37.98, 23.73] },
  'UAE':                       { capital: 'Abu Dhabi',        language: 'Arabic',     currency: 'AED (د.إ)', timezone: 'UTC+4',        tz: 'Asia/Dubai',         emergency: '999',  adapter: 'Type G',   languageCode: 'ar',  coords: [25.20, 55.27] },
  'Singapore':                 { capital: 'Singapore',        language: 'English / Mandarin', currency: 'SGD (S$)', timezone: 'UTC+8', tz: 'Asia/Singapore',    emergency: '999',  adapter: 'Type G',   languageCode: 'en',  coords: [1.35, 103.82] },
  'Portugal':                  { capital: 'Lisbon',           language: 'Portuguese', currency: 'EUR (€)',  timezone: 'UTC+0/+1',      tz: 'Europe/Lisbon',      emergency: '112',  adapter: 'Type C/F', languageCode: 'pt',  coords: [38.72, -9.14] },
  'Mexico':                    { capital: 'Mexico City',      language: 'Spanish',    currency: 'MXN ($)',  timezone: 'UTC−6 to −8',   tz: 'America/Mexico_City', emergency: '911',  adapter: 'Type A/B', languageCode: 'es',  coords: [19.43, -99.13] },
  'Turkey':                    { capital: 'Ankara',           language: 'Turkish',    currency: 'TRY (₺)', timezone: 'UTC+3',          tz: 'Europe/Istanbul',    emergency: '112',  adapter: 'Type C/F', languageCode: 'tr',  coords: [41.01, 28.98] },
  'Bosnia and Herzegovina':    { capital: 'Sarajevo',         language: 'Bosnian / Croatian / Serbian', currency: 'BAM (KM)', timezone: 'UTC+1/+2', tz: 'Europe/Sarajevo', emergency: '112', adapter: 'Type C/F', languageCode: 'bs', coords: [43.86, 18.41] },
  'Morocco':                   { capital: 'Rabat',            language: 'Arabic / French', currency: 'MAD (DH)', timezone: 'UTC+1',   tz: 'Africa/Casablanca',  emergency: '190',  adapter: 'Type C/E', languageCode: 'ar',  coords: [33.99, -6.85] },
  'Indonesia':                 { capital: 'Jakarta',          language: 'Indonesian', currency: 'IDR (Rp)', timezone: 'UTC+7 to +9',   tz: 'Asia/Jakarta',       emergency: '112',  adapter: 'Type C/F', languageCode: 'id',  coords: [-6.21, 106.85] },
  'Sri Lanka':                 { capital: 'Colombo',          language: 'Sinhala / Tamil', currency: 'LKR (₨)', timezone: 'UTC+5:30', tz: 'Asia/Colombo',      emergency: '119',  adapter: 'Type D/G', languageCode: 'si',  coords: [6.93, 79.85] },
}

export interface Phrase { en: string; local: string; pronunciation?: string }

export const PHRASES: Record<string, Phrase[]> = {
  fr: [
    { en: 'Hello',          local: 'Bonjour',          pronunciation: 'bon-ZHOOR' },
    { en: 'Thank you',      local: 'Merci',             pronunciation: 'mair-SEE' },
    { en: 'Please',         local: "S'il vous plaît",  pronunciation: 'seel voo PLAY' },
    { en: 'Excuse me',      local: 'Excusez-moi',      pronunciation: 'ex-koo-ZAY mwah' },
    { en: 'Where is...?',   local: 'Où est...?',        pronunciation: 'oo AY' },
    { en: 'How much?',      local: 'Combien?',          pronunciation: 'kom-BYAH' },
    { en: 'Yes / No',       local: 'Oui / Non',         pronunciation: 'wee / non' },
    { en: 'Do you speak English?', local: 'Parlez-vous anglais?', pronunciation: 'par-lay voo on-GLAY' },
  ],
  ja: [
    { en: 'Hello',          local: 'こんにちは',          pronunciation: 'Kon-ni-chi-wa' },
    { en: 'Thank you',      local: 'ありがとう',           pronunciation: 'A-ri-ga-tou' },
    { en: 'Please',         local: 'お願いします',          pronunciation: 'O-ne-gai shi-mas' },
    { en: 'Excuse me',      local: 'すみません',            pronunciation: 'Su-mi-ma-sen' },
    { en: 'Where is...?',   local: '...はどこですか?',      pronunciation: '...wa do-ko des-ka' },
    { en: 'How much?',      local: 'いくらですか?',          pronunciation: 'I-ku-ra des-ka' },
    { en: 'Yes / No',       local: 'はい / いいえ',         pronunciation: 'Hai / Iie' },
    { en: 'I don\'t understand', local: 'わかりません',      pronunciation: 'Wa-ka-ri-ma-sen' },
  ],
  es: [
    { en: 'Hello',          local: 'Hola',               pronunciation: 'OH-la' },
    { en: 'Thank you',      local: 'Gracias',             pronunciation: 'GRAH-see-as' },
    { en: 'Please',         local: 'Por favor',           pronunciation: 'por fa-VOR' },
    { en: 'Excuse me',      local: 'Perdón',              pronunciation: 'pair-DON' },
    { en: 'Where is...?',   local: '¿Dónde está...?',    pronunciation: 'DON-day es-TA' },
    { en: 'How much?',      local: '¿Cuánto cuesta?',    pronunciation: 'KWAN-toh KWES-ta' },
    { en: 'Yes / No',       local: 'Sí / No',            pronunciation: 'see / no' },
    { en: 'Do you speak English?', local: '¿Habla inglés?', pronunciation: 'AH-bla een-GLES' },
  ],
  it: [
    { en: 'Hello',          local: 'Ciao / Buongiorno',  pronunciation: 'chow / bwon-JOR-no' },
    { en: 'Thank you',      local: 'Grazie',              pronunciation: 'GRAT-syeh' },
    { en: 'Please',         local: 'Per favore',          pronunciation: 'pair fa-VOR-ay' },
    { en: 'Excuse me',      local: 'Mi scusi',            pronunciation: 'mee SKOO-zee' },
    { en: 'Where is...?',   local: 'Dov\'è...?',         pronunciation: 'doh-VEH' },
    { en: 'How much?',      local: 'Quanto costa?',       pronunciation: 'KWAN-toh KOS-ta' },
    { en: 'Yes / No',       local: 'Sì / No',            pronunciation: 'see / no' },
    { en: 'Do you speak English?', local: 'Parla inglese?', pronunciation: 'PAR-la een-GLAY-zay' },
  ],
  de: [
    { en: 'Hello',          local: 'Hallo / Guten Tag',  pronunciation: 'HA-lo / GOO-ten tahk' },
    { en: 'Thank you',      local: 'Danke',               pronunciation: 'DAHN-keh' },
    { en: 'Please',         local: 'Bitte',               pronunciation: 'BIT-teh' },
    { en: 'Excuse me',      local: 'Entschuldigung',      pronunciation: 'ent-SHUL-di-goong' },
    { en: 'Where is...?',   local: 'Wo ist...?',          pronunciation: 'voh ist' },
    { en: 'How much?',      local: 'Wie viel kostet das?', pronunciation: 'vee feel KOS-tet das' },
    { en: 'Yes / No',       local: 'Ja / Nein',           pronunciation: 'ya / nine' },
    { en: 'Do you speak English?', local: 'Sprechen Sie Englisch?', pronunciation: 'SHPREH-chen zee ENG-lish' },
  ],
  hi: [
    { en: 'Hello',          local: 'नमस्ते',              pronunciation: 'Na-mas-tey' },
    { en: 'Thank you',      local: 'धन्यवाद',             pronunciation: 'Dhanya-vaad' },
    { en: 'Please',         local: 'कृपया',               pronunciation: 'Kripa-ya' },
    { en: 'Excuse me',      local: 'माफ़ करना',            pronunciation: 'Maaf kar-na' },
    { en: 'Where is...?',   local: '...कहाँ है?',          pronunciation: '...kahan hai' },
    { en: 'How much?',      local: 'कितना?',               pronunciation: 'Kit-na' },
    { en: 'Yes / No',       local: 'हाँ / नहीं',           pronunciation: 'Haan / Nahin' },
    { en: 'I don\'t understand', local: 'मुझे समझ नहीं आया', pronunciation: 'Mujhe samajh nahin aaya' },
  ],
  bs: [
    { en: 'Hello',          local: 'Zdravo',              pronunciation: 'ZDRA-voh' },
    { en: 'Thank you',      local: 'Hvala',               pronunciation: 'HVAH-la' },
    { en: 'Please',         local: 'Molim',               pronunciation: 'MOH-leem' },
    { en: 'Excuse me',      local: 'Izvinite',            pronunciation: 'iz-VEE-nee-teh' },
    { en: 'Where is...?',   local: 'Gdje je...?',         pronunciation: 'GDYEH yeh' },
    { en: 'How much?',      local: 'Koliko košta?',       pronunciation: 'KOH-lee-koh KOSH-ta' },
    { en: 'Yes / No',       local: 'Da / Ne',             pronunciation: 'da / neh' },
    { en: 'Do you speak English?', local: 'Govorite li engleski?', pronunciation: 'go-VOR-ee-teh lee eng-LES-kee' },
  ],
}

export interface WeatherSummary {
  avgMaxC: number
  avgMinC: number
  maxRainProb: number
  days: number
}

export async function fetchWeather(coords: [number, number], startDate: string, endDate: string): Promise<WeatherSummary | null> {
  try {
    // Clamp dates to Open-Meteo's 16-day forecast window
    const today = new Date()
    const start = new Date(startDate)
    const end   = new Date(endDate)
    const maxForecast = new Date(today.getTime() + 16 * 86400000)

    const fetchStart = start < today ? today : start
    const fetchEnd   = end > maxForecast ? maxForecast : end
    if (fetchStart > fetchEnd) return null  // trip is entirely in the past or too far ahead

    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${fmt(fetchStart)}&end_date=${fmt(fetchEnd)}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json() as {
      daily: {
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_max: number[]
      }
    }

    const maxTemps   = data.daily.temperature_2m_max ?? []
    const minTemps   = data.daily.temperature_2m_min ?? []
    const rainProbs  = data.daily.precipitation_probability_max ?? []
    if (!maxTemps.length) return null

    const avgMax = maxTemps.reduce((s, v) => s + v, 0) / maxTemps.length
    const avgMin = minTemps.reduce((s, v) => s + v, 0) / minTemps.length
    const maxRain = Math.max(...rainProbs)

    return { avgMaxC: Math.round(avgMax), avgMinC: Math.round(avgMin), maxRainProb: maxRain, days: maxTemps.length }
  } catch {
    return null
  }
}
