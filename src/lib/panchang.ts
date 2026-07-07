import { getPanchangam, Observer } from "@ishubhamx/panchangam-js";

const IST_OFFSET_MIN = 330;
const DEFAULT_LAT = 28.6356;
const DEFAULT_LON = 77.2244;
const DEFAULT_ELEVATION_M = 216;

const TITHI_NAMES = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी",
  "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
  "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा",
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी",
  "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
  "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "अमावस्या",
];

const VAAR = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];

const NAKSHATRA = [
  "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा",
  "पुनर्वसु", "पुष्य", "आश्लेषा", "मघा", "पूर्वा फाल्गुनी", "उत्तरा फाल्गुनी",
  "हस्त", "चित्रा", "स्वाति", "विशाखा", "अनुराधा", "ज्येष्ठा",
  "मूल", "पूर्वाषाढ़ा", "उत्तराषाढ़ा", "श्रवण", "धनिष्ठा", "शतभिषा",
  "पूर्वा भाद्रपद", "उत्तरा भाद्रपद", "रेवती",
];

const YOGA = [
  "विष्कुम्भ", "प्रीति", "आयुष्मान", "सौभाग्य", "शोभन", "अतिगण्ड", "सुकर्मा", "धृति", "शूल",
  "गण्ड", "वृद्धि", "ध्रुव", "व्याघात", "हर्षण", "वज्र", "सिद्धि", "व्यतीपात", "वरीयान",
  "परिघ", "शिव", "सिद्ध", "साध्य", "शुभ", "शुक्ल", "ब्रह्म", "इन्द्र", "वैधृति",
];

const KARANA_HI: Record<string, string> = {
  Bava: "बव",
  Balava: "बालव",
  Kaulava: "कौलव",
  Taitila: "तैतिल",
  Gara: "गरज",
  Garaja: "गरज",
  Vanija: "वणिज",
  Vishti: "विष्टि",
  Shakuni: "शकुनि",
  Chatushpada: "चतुष्पाद",
  Naga: "नाग",
  Kimstughna: "किंस्तुघ्न",
};

const MASA = [
  "चैत्र", "वैशाख", "ज्येष्ठ", "आषाढ़", "श्रावण", "भाद्रपद",
  "आश्विन", "कार्तिक", "मार्गशीर्ष", "पौष", "माघ", "फाल्गुन",
];

const RITU = ["वसंत", "ग्रीष्म", "वर्षा", "शरद", "हेमंत", "शिशिर"];

export type Panchang = {
  gregorian: string;      // "2 जुलाई 2026"
  vaar: string;
  paksha: string;         // शुक्ल पक्ष / कृष्ण पक्ष
  tithi: string;          // तृतीया etc.
  tithiFull: string;      // "कृष्ण पक्ष तृतीया"
  isPurnima: boolean;
  isAmavasya: boolean;
  isEkadashi: boolean;
  masa: string;
  nakshatra: string;
  sunrise: string;        // "05:46 AM"
  sunset: string;         // "07:22 PM"
  yoga: string;
  karana: string;
  ayana: string;          // उत्तरायण / दक्षिणायन
  ritu: string;
  festival?: string;
};

/** Get calendar day components in IST for a given Date. */
function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return {
    y: ist.getUTCFullYear(),
    m: ist.getUTCMonth(),
    d: ist.getUTCDate(),
    wd: ist.getUTCDay(),
  };
}

const HINDI_MONTHS_G = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

const FIXED_FESTIVALS: Record<string, string> = {
  "01-01": "नव वर्ष",
  "01-14": "मकर संक्रांति",
  "01-26": "गणतंत्र दिवस",
  "08-15": "स्वतंत्रता दिवस",
  "10-02": "गांधी जयंती",
  "12-25": "क्रिसमस",
};

function purgeLegacyPanchangCaches() {
  const shouldRemove = (k: string) => /panchang|tithi/i.test(k);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && shouldRemove(k)) localStorage.removeItem(k);
    }
  } catch {}
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && shouldRemove(k)) sessionStorage.removeItem(k);
    }
  } catch {}
  try {
    if ("caches" in window) caches.keys().then((keys) => keys.forEach((k) => { if (shouldRemove(k)) caches.delete(k); }));
  } catch {}
  try {
    if (indexedDB.databases) {
      indexedDB.databases().then((dbs) => dbs.forEach((db) => {
        if (db.name && shouldRemove(db.name)) indexedDB.deleteDatabase(db.name);
      }));
    }
  } catch {}
}

purgeLegacyPanchangCaches();

function formatDateInIST(date: Date): string {
  const parts = new Intl.DateTimeFormat("hi-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("day")} ${get("month")} ${get("year")}`;
}

function formatTimeInIST(date: Date | null | undefined): string {
  if (!date) return "—";
  const rounded = new Date(Math.round(date.getTime() / 60_000) * 60_000);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(rounded).toUpperCase();
}

function normalizeTithiIndex(index: number): number {
  return Math.max(0, Math.min(29, index));
}

export function computePanchang(
  date: Date = new Date(),
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON,
): Panchang {
  const ist = istParts(date);
  const civilDay = new Date(Date.UTC(ist.y, ist.m, ist.d, 0, 0, 0) - IST_OFFSET_MIN * 60_000);
  const observer = new Observer(lat, lon, DEFAULT_ELEVATION_M);
  const p = getPanchangam(civilDay, observer, { timezoneOffset: IST_OFFSET_MIN, calendarType: "purnimanta" });

  const tithiIndex = normalizeTithiIndex(p.tithi);
  const paksha = p.paksha === "Krishna" ? "कृष्ण पक्ष" : "शुक्ल पक्ष";
  const tithi = TITHI_NAMES[tithiIndex] || (p.tithis?.[0]?.name ?? "—");
  const isPurnima = tithiIndex === 14;
  const isAmavasya = tithiIndex === 29;
  const isEkadashi = tithiIndex === 10 || tithiIndex === 25;

  const nakshatra = NAKSHATRA[p.nakshatra] || (p.nakshatras?.[0]?.name ?? "—");
  const masa = MASA[p.masa.index] || p.masa.name;
  const ayana = p.ayana === "Dakshinayana" ? "दक्षिणायन" : "उत्तरायण";
  const ritu = RITU.indexOf(p.ritu) >= 0 ? p.ritu : ({
    Vasanta: "वसंत",
    Grishma: "ग्रीष्म",
    Varsha: "वर्षा",
    Sharad: "शरद",
    Hemanta: "हेमंत",
    Shishira: "शिशिर",
  } as Record<string, string>)[p.ritu] || p.ritu;

  const vaar = VAAR[ist.wd];
  const gregorian = formatDateInIST(civilDay);
  const mmdd = `${String(ist.m + 1).padStart(2, "0")}-${String(ist.d).padStart(2, "0")}`;

  let festival: string | undefined = FIXED_FESTIVALS[mmdd];
  if (isPurnima) festival = festival ? `${festival} • पूर्णिमा` : "पूर्णिमा";
  else if (isAmavasya) festival = festival ? `${festival} • अमावस्या` : "अमावस्या";
  else if (isEkadashi) festival = festival ? `${festival} • एकादशी` : "एकादशी";

  return {
    gregorian,
    vaar,
    paksha,
    tithi,
    tithiFull: `${paksha} ${tithi}`,
    isPurnima,
    isAmavasya,
    isEkadashi,
    masa,
    nakshatra,
    sunrise: formatTimeInIST(p.sunrise),
    sunset: formatTimeInIST(p.sunset),
    yoga: YOGA[p.yoga] || p.yogas?.[0]?.name || "—",
    karana: KARANA_HI[p.karana] || p.karana || "—",
    ayana,
    ritu,
    festival,
  };
}
