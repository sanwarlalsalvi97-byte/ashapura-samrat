import { Link } from "react-router-dom";
import { BarChart3, CheckCircle2, LockKeyhole, MapPin, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/logo.png";

const features = [
  { icon: CheckCircle2, title: "तेज़ हाजिरी", text: "एक टैप, GPS और वैकल्पिक फेस स्कैन से रोज़ की हाजिरी दर्ज करें।" },
  { icon: LockKeyhole, title: "सुरक्षित लॉगिन", text: "हर ठेकेदार का डेटा अलग और सुरक्षित रहता है।" },
  { icon: BarChart3, title: "तुरंत रिपोर्ट", text: "मजदूरी, एडवांस, भुगतान और साइट खर्च की साफ रिपोर्ट देखें।" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2" aria-label="Ashapura Samrat home">
            <img src={logoUrl} alt="Ashapura Samrat logo" className="h-10 w-10 object-contain" />
            <span className="font-bold">Ashapura Samrat</span>
          </Link>
          <Button asChild size="sm"><Link to="/app">लॉगिन</Link></Button>
        </div>
      </header>

      <main>
        <section className="border-b border-border">
          <div className="mx-auto grid min-h-[70vh] max-w-5xl content-center gap-8 px-4 py-14 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" /> ठेकेदारों के लिए भरोसेमंद प्रबंधन
              </div>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">Ashapura Samrat</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                मजदूर हाजिरी, साइट, मजदूरी, एडवांस और भुगतान का पूरा हिसाब एक सुरक्षित ऐप में।
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/app">लॉगिन / डैशबोर्ड</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/privacy-policy">गोपनीयता नीति</Link></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3" aria-label="App highlights">
              <div className="rounded-lg border border-border bg-card p-5"><Users className="mb-5 h-8 w-8 text-primary" /><p className="font-bold">मजदूर प्रबंधन</p></div>
              <div className="rounded-lg border border-border bg-card p-5"><MapPin className="mb-5 h-8 w-8 text-accent" /><p className="font-bold">GPS हाजिरी</p></div>
              <div className="col-span-2 rounded-lg border border-border bg-card p-5"><BarChart3 className="mb-5 h-8 w-8 text-primary" /><p className="font-bold">रियल-टाइम मजदूरी और रिपोर्ट</p></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-6 text-2xl font-bold">काम का हिसाब, बिना उलझन</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-border bg-card p-5">
                <Icon className="mb-4 h-6 w-6 text-primary" />
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Ashapura Samrat</span>
          <nav className="flex gap-4" aria-label="Legal links">
            <Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}