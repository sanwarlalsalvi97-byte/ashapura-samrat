import { CalendarCheck, Users, BarChart3, Settings, Wallet, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TabId =
  | "home"
  | "attendance"
  | "advance"
  | "cashbook"
  | "workers"
  | "contractors"
  | "bricks"
  | "material_entry"
  | "roof"
  | "report"
  | "settings"
  | "subscription"
  | "manage_subscription"
  | "sites"
  | "pending"
  | "worker_expense"
  | "payment_history"
  | "punch"
  | "geo_admin";

interface Props {
  active: TabId;
  onNavigate: (tab: TabId) => void;
  /** Restrict visible tabs (e.g. read-only worker accounts). */
  allowed?: TabId[];
}

const tabs = [
  { id: "home" as const, label: "होम", icon: Home },
  { id: "attendance" as const, label: "हाजिरी", icon: CalendarCheck },
  { id: "advance" as const, label: "एडवांस", icon: Wallet },
  { id: "workers" as const, label: "मजदूर", icon: Users },
  { id: "report" as const, label: "रिपोर्ट", icon: BarChart3 },
  { id: "settings" as const, label: "सेटिंग्स", icon: Settings },
];

export default function BottomNav({ active, onNavigate, allowed }: Props) {
  const visible = allowed ? tabs.filter((t) => allowed.includes(t.id)) : tabs;

  return (
    <nav
      aria-label="मुख्य नेविगेशन"
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 px-0.5"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
      }}
    >
      <div className="flex items-center h-16 max-w-lg mx-auto w-full">
        {visible.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            aria-current={active === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
            className={`h-14 basis-0 min-w-0 flex-1 flex-col items-center gap-0.5 px-0 py-1.5 rounded-md transition-colors ${
              active === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon
              className={`!w-4 !h-4 shrink-0 ${
                active === id ? "stroke-[2.5]" : ""
              }`}
            />
            <span className="text-[10px] leading-3 whitespace-nowrap font-medium overflow-hidden text-ellipsis w-full text-center">
              {label}
            </span>
          </Button>
        ))}
      </div>
    </nav>
  );
}
