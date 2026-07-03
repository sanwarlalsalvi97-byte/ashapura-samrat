/**
 * Panchang — approximate Indian Vedic calendar computations.
 * All times are computed for Asia/Kolkata (IST, UTC+5:30).
 * Default observer: New Delhi (28.6139° N, 77.2090° E) — reasonable for pan-India display.
 *
 * These are astronomical approximations (not drik-siddha grade), accurate to a few
 * minutes for sunrise/sunset and to one tithi/nakshatra step for calendar labels.
 */

const IST_OFFSET_MIN = 330; // UTC+5:30
const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.2090;

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
  ayana: string;          // उत्तरायण / दक्षिणायन
  ritu: string;
  festival?: string;
};

/* ---------- Astronomy helpers ---------- */

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

/** Julian Day for given Date (UTC). */
function julianDay(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

/** Sun ecliptic longitude (tropical), degrees. */
function sunLongitude(jd: number): number {
  const n = jd - 2451545.0;
  const L = norm360(280.460 + 0.9856474 * n);
  const g = rad(norm360(357.528 + 0.9856003 * n));
  return norm360(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

/** Moon ecliptic longitude (tropical), degrees. Low-precision. */
function moonLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.2720950 + 483202.0175233 * T;
  const lon =
    Lp +
    6.289 * Math.sin(rad(Mp)) -
    1.274 * Math.sin(rad(Mp - 2 * D)) +
    0.658 * Math.sin(rad(2 * D)) -
    0.186 * Math.sin(rad(M)) -
    0.059 * Math.sin(rad(2 * Mp - 2 * D)) -
    0.057 * Math.sin(rad(Mp - 2 * D + M)) +
    0.053 * Math.sin(rad(Mp + 2 * D)) +
    0.046 * Math.sin(rad(2 * D - M)) +
    0.041 * Math.sin(rad(Mp - M)) -
    0.035 * Math.sin(rad(D)) -
    0.031 * Math.sin(rad(Mp + M)) -
    0.015 * Math.sin(rad(2 * F - 2 * D)) +
    0.011 * Math.sin(rad(Mp - 4 * D));
  return norm360(lon);
}

/** Ayanamsa (Lahiri) approximation for sidereal conversion. */
function ayanamsa(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return 23.85 + 0.013 * T * 100; // ~23.85° at J2000, ~24.2° by 2026
}

/** Sunrise/Sunset (UTC hours) using NOAA approximation. Returns null if no rise. */
function sunEvent(dateUTC: Date, lat: number, lon: number, rising: boolean): number | null {
  // Rough NOAA algorithm.
  const zenith = 90.833;
  const N = Math.floor((julianDay(dateUTC) - 2451545.0) + 0.0008);
  // day of year
  const start = Date.UTC(dateUTC.getUTCFullYear(), 0, 0);
  const doy = Math.floor((dateUTC.getTime() - start) / 86400000);

  const lngHour = lon / 15;
  const t = doy + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(rad(M)) + 0.020 * Math.sin(rad(2 * M)) + 282.634;
  L = norm360(L);
  let RA = deg(Math.atan(0.91764 * Math.tan(rad(L))));
  RA = norm360(RA);
  const Lq = Math.floor(L / 90) * 90;
  const RAq = Math.floor(RA / 90) * 90;
  RA = RA + (Lq - RAq);
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(rad(L));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(rad(zenith)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)));
  if (cosH > 1 || cosH < -1) return null;
  let H = rising ? 360 - deg(Math.acos(cosH)) : deg(Math.acos(cosH));
  H /= 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;
  void N;
  return UT;
}

function formatHM12(utcHours: number, offsetMin = IST_OFFSET_MIN): string {
  let h = utcHours + offsetMin / 60;
  h = ((h % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${period}`;
}

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

export function computePanchang(
  date: Date = new Date(),
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON,
): Panchang {
  // Sunrise-anchored: compute at IST sunrise for the given calendar date.
  const ist = istParts(date);
  const dayStartUTC = new Date(Date.UTC(ist.y, ist.m, ist.d, 0, 0, 0));
  const sunriseUT = sunEvent(dayStartUTC, lat, lon, true);
  const sunsetUT = sunEvent(dayStartUTC, lat, lon, false);
  const anchorJD = julianDay(dayStartUTC) + ((sunriseUT ?? 0) / 24);

  // Tithi from sun/moon separation
  const sunLon = sunLongitude(anchorJD);
  const moonLon = moonLongitude(anchorJD);
  const diff = norm360(moonLon - sunLon);
  const tithiIndex = Math.floor(diff / 12); // 0..29
  const paksha = tithiIndex < 15 ? "शुक्ल पक्ष" : "कृष्ण पक्ष";
  const tithi = TITHI_NAMES[tithiIndex];
  const isPurnima = tithiIndex === 14;
  const isAmavasya = tithiIndex === 29;
  const isEkadashi = tithiIndex === 10 || tithiIndex === 25;

  // Nakshatra from sidereal moon longitude
  const siderealMoon = norm360(moonLon - ayanamsa(anchorJD));
  const nakIdx = Math.floor(siderealMoon / (360 / 27)) % 27;
  const nakshatra = NAKSHATRA[nakIdx];

  // Masa (Amanta-ish): based on sun's sidereal sign at new moon; we approximate from sun's current sidereal longitude.
  const siderealSun = norm360(sunLon - ayanamsa(anchorJD));
  // Chaitra begins near sun entering Meena (Pisces, 330°) / Mesha (Aries, 0°).
  // Amanta masa index ≈ floor(siderealSun/30) offset so Chaitra ≈ when sun in Meena end / Mesha.
  const masaIdx = Math.floor(norm360(siderealSun) / 30) % 12; // 0..11
  const masa = MASA[masaIdx];

  // Ayana: Sun's tropical longitude. Uttarayana: after winter solstice (270°..360°..90°); Dakshinayana: 90°..270°.
  const ayana = sunLon >= 90 && sunLon < 270 ? "दक्षिणायन" : "उत्तरायण";

  // Ritu: pair of masa. Chaitra-Vaishakha=वसंत ...
  const rituIdx = Math.floor(masaIdx / 2) % 6;
  const ritu = RITU[rituIdx];

  const vaar = VAAR[ist.wd];
  const gregorian = `${ist.d} ${HINDI_MONTHS_G[ist.m]} ${ist.y}`;
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
    sunrise: sunriseUT != null ? formatHM12(sunriseUT) : "—",
    sunset: sunsetUT != null ? formatHM12(sunsetUT) : "—",
    ayana,
    ritu,
    festival,
  };
}
