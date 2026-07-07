import { describe, expect, it } from "vitest";
import { computePanchang } from "@/lib/panchang";

describe("Panchang verified against Drik Panchang New Delhi", () => {
  it("matches 5 July 2026", () => {
    const p = computePanchang(new Date("2026-07-05T00:00:00+05:30"));
    expect(p.tithi).toBe("पंचमी");
    expect(p.paksha).toBe("कृष्ण पक्ष");
    expect(p.nakshatra).toBe("शतभिषा");
    expect(p.masa).toBe("आषाढ़");
    expect(p.yoga).toBe("आयुष्मान");
    expect(p.karana).toBe("तैतिल");
    expect(p.sunrise).toBe("05:28 AM");
    expect(p.sunset).toBe("07:23 PM");
  });

  it("matches 6 July 2026", () => {
    const p = computePanchang(new Date("2026-07-06T00:00:00+05:30"));
    expect(p.tithi).toBe("षष्ठी");
    expect(p.paksha).toBe("कृष्ण पक्ष");
    expect(p.nakshatra).toBe("पूर्वा भाद्रपद");
    expect(p.masa).toBe("आषाढ़");
    expect(p.yoga).toBe("सौभाग्य");
    expect(p.karana).toBe("वणिज");
    expect(p.sunrise).toBe("05:29 AM");
    expect(p.sunset).toBe("07:23 PM");
  });
});