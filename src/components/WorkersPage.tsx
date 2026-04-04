import { useState, useEffect } from "react";
import { getWorkers, type Worker } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import AddWorkerDialog from "./AddWorkerDialog";
import { Phone } from "lucide-react";
import { motion } from "framer-motion";

const roleColors: Record<string, string> = {
  "मिस्त्री": "bg-primary/15 text-primary",
  "मजदूर": "bg-accent/15 text-accent",
  "हेल्पर": "bg-muted text-muted-foreground",
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);

  const load = async () => {
    try { setWorkers(await getWorkers()); } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">मजदूरों की सूची ({workers.length})</h2>
        <AddWorkerDialog onAdded={load} />
      </div>

      {workers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">अभी कोई मजदूर नहीं</p>
          <p className="text-sm mt-1">ऊपर "मजदूर जोड़ें" बटन दबाएं</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((w, i) => (
            <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{w.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[w.role] || ""}`}>
                        {w.role}
                      </span>
                      <span className="text-xs text-muted-foreground">₹{w.daily_rate}/दिन</span>
                      {w.site_name && <span className="text-xs text-muted-foreground">• {w.site_name}</span>}
                    </div>
                  </div>
                  {w.phone && (
                    <a href={`tel:${w.phone}`} className="p-2 rounded-full bg-accent/10 text-accent">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
