import { Link } from "react-router-dom";
import { ArrowLeft, FileCheck2 } from "lucide-react";

const sections = [
  ["सेवा का उपयोग / Use of Service", "Ashapura Samrat मजदूर हाजिरी, मजदूरी, साइट और व्यावसायिक रिकॉर्ड व्यवस्थित करने का साधन है। दर्ज जानकारी की शुद्धता की जिम्मेदारी खाते के मालिक की है।"],
  ["खाता और सुरक्षा / Account & Security", "अपने लॉगिन और PIN को सुरक्षित रखें। बिना अनुमति किसी अन्य व्यक्ति के खाते या रिकॉर्ड का उपयोग न करें।"],
  ["फोटो और लोकेशन / Photos & Location", "कैमरा, फोटो और GPS सुविधाएँ वैकल्पिक सत्यापन के लिए हैं। इनका उपयोग केवल संबंधित व्यक्ति की जानकारी और लागू कानूनों के अनुसार करें।"],
  ["डेटा और बैकअप / Data & Backup", "ऐप डेटा सुरक्षित रखने का प्रयास करता है, फिर भी महत्वपूर्ण रिकॉर्ड का नियमित Google Drive या फ़ाइल बैकअप रखना आपकी जिम्मेदारी है।"],
  ["भुगतान / Payments", "सदस्यता या मजदूरी भुगतान से पहले राशि और प्राप्तकर्ता की जाँच करें। बाहरी UPI या स्टोर भुगतान सेवाओं पर उनके नियम लागू होते हैं।"],
  ["परिवर्तन / Changes", "सेवा, कीमत या इन शर्तों में आवश्यक बदलाव किए जा सकते हैं। महत्वपूर्ण बदलाव ऐप या वेबसाइट पर बताए जाएंगे।"],
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted" aria-label="Back to home"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-base font-bold">सेवा की शर्तें / Terms of Service</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <section className="rounded-lg border border-primary/20 bg-primary/10 p-5">
          <FileCheck2 className="mb-3 h-7 w-7 text-primary" />
          <h2 className="font-bold">Ashapura Samrat का उपयोग</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">ऐप का उपयोग करके आप नीचे दी गई शर्तों से सहमत होते हैं।</p>
        </section>
        {sections.map(([title, text]) => (
          <section key={title} className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </section>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">अंतिम अपडेट / Last updated: 14 September 2026</p>
      </main>
    </div>
  );
}