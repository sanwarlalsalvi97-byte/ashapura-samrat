import { CalendarCheck, Users, BarChart3, Settings, Wallet, Layers, HardHat, Home } from "lucide-react";

export type TabId = "attendance" | "advance" | "workers" | "contractors" | "bricks" | "roof" | "report" | "settings";

interface Props {
  active: TabId;
  onNavigate: (tab: TabId) => void;
}

const tabs = [
  { id: "attendance" as const, label: "हाजिरी", icon: CalendarCheck },
  { id: "advance" as const, label: "एडवांस", icon: Wallet },
  { id: "workers" as const, label: "मजदूर", icon: Users },
  { id: "contractors" as const, label: "ठेकेदार", icon: HardHat },
  { id: "bricks" as const, label: "ईंट", icon: Layers },
  { id: "roof" as const, label: "छत", icon: Home },
  { id: "report" as const, label: "रिपोर्ट", icon: BarChart3 },
  { id: "settings" as const, label: "सेटिंग्स", icon: Settings },
];

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex overflow-x-auto items-center h-16 max-w-lg mx-auto px-1 no-scrollbar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors shrink-0 min-w-[52px] ${
              active === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`w-5 h-5 ${active === id ? "stroke-[2.5]" : ""}`} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
