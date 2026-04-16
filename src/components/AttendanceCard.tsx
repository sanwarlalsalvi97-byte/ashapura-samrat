import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markAttendance, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Check, X, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  worker: Worker;
  date: string;
  currentStatus?: AttendanceStatus;
  currentAdvance?: number;
  onMarked: () => void;
}

const statusConfig: Record<AttendanceStatus, { label: string; icon: typeof Check; className: string }> = {
  Present: { label: "हाजिर", icon: Check, className: "bg-success text-success-foreground" },
  "Half-Day": { label: "आधा दिन", icon: Clock, className: "bg-warning text-warning-foreground" },
  Absent: { label: "गैरहाजिर", icon: X, className: "bg-destructive text-destructive-foreground" },
};

const roleColors: Record<string, string> = {
  "मिस्त्री": "bg-primary/15 text-primary",
  "मजदूर": "bg-accent/15 text-accent",
  "हेल्पर": "bg-muted text-muted-foreground",
};

export default function AttendanceCard({ worker, date, currentStatus, currentAdvance, onMarked }: Props) {
  const [advance, setAdvance] = useState(String(currentAdvance || 0));
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | undefined>(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleSaveAttendance = async () => {
    if (!selectedStatus) {
      toast({ title: "पहले हाजिरी चुनें", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await markAttendance({
        worker_id: worker.id,
        date,
        status: selectedStatus,
        advance: parseInt(advance) || 0,
        site_name: worker.site_name,
      });
      toast({ title: `${worker.name} — ${statusConfig[selectedStatus].label} सेव हो गया` });
      onMarked();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdvance = async () => {
    const status = selectedStatus || currentStatus || "Present";
    setLoading(true);
    try {
      await markAttendance({
        worker_id: worker.id,
        date,
        status,
        advance: parseInt(advance) || 0,
        site_name: worker.site_name,
      });
      toast({ title: `${worker.name} — एडवांस ₹${advance} सेव हो गया` });
      onMarked();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className={`overflow-hidden ${currentStatus ? "ring-2 ring-primary/20" : ""}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">{worker.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[worker.role] || ""}`}>
                  {worker.role}
                </span>
                <span className="text-xs text-muted-foreground">₹{worker.daily_rate}/दिन</span>
              </div>
            </div>
            {currentStatus && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig[currentStatus].className}`}>
                {statusConfig[currentStatus].label}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {(Object.keys(statusConfig) as AttendanceStatus[]).map((status) => {
              const config = statusConfig[status];
              const Icon = config.icon;
              const isActive = selectedStatus === status;
              return (
                <Button
                  key={status}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className={`flex-1 gap-1 text-xs ${isActive ? config.className : ""}`}
                  onClick={() => setSelectedStatus(status)}
                  disabled={loading}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </Button>
              );
            })}
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={handleSaveAttendance}
            disabled={loading || !selectedStatus}
          >
            <Check className="w-4 h-4" />
            हाजिरी सेव करें
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">एडवांस ₹</span>
            <Input
              type="number"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              className="h-8 text-sm"
              min={0}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveAdvance}
              disabled={loading}
              className="whitespace-nowrap"
            >
              सेव
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}