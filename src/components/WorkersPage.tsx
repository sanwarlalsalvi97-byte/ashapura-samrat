import { useState, useEffect } from "react";
import { getWorkers, deleteWorker, type Worker } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import AddWorkerDialog from "./AddWorkerDialog";
import EditWorkerDialog from "./EditWorkerDialog";
import UpiPayDialog from "./UpiPayDialog";
import { Phone, Trash2, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const roleColors: Record<string, string> = {
  "मिस्त्री": "bg-primary/15 text-primary",
  "मजदूर": "bg-accent/15 text-accent",
  "हेल्पर": "bg-muted text-muted-foreground",
  "ठेकेदार": "bg-destructive/15 text-destructive",
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payTarget, setPayTarget] = useState<Worker | null>(null);

  const load = async () => {
    try { setWorkers(await getWorkers()); } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (worker: Worker) => {
    try {
      await deleteWorker(worker.id);
      toast({ title: `✅ ${worker.name} को हटा दिया गया` });
      load();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    }
  };

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
                    <div className="flex items-center gap-2">
                    <EditWorkerDialog worker={w} onUpdated={load} />
                    {(w as any).upi_id && (
                      <button onClick={() => setPayTarget(w)} className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20" title="UPI से पेमेंट">
                        <Smartphone className="w-4 h-4" />
                      </button>
                    )}
                    {w.phone && (
                      <a href={`tel:${w.phone}`} className="p-2 rounded-full bg-accent/10 text-accent">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>क्या आप पक्के हैं?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {w.name} को सूची से हटा दिया जाएगा। उनकी पुरानी हाजिरी रिपोर्ट में दिखती रहेगी।
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>रहने दें</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(w)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            हटाएं
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
