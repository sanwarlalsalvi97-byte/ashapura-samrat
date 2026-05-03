import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { Check, X, Clock } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  worker: Worker;
  date: string;
  currentStatus?: AttendanceStatus;
  currentAdvance?: number;
  onMarked: () => void;
  onSelectionChange?: (workerId: string, status: AttendanceStatus | undefined) => void;
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

export default function AttendanceCard({ worker, currentStatus, currentAdvance, onSelectionChange }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | undefined>(currentStatus);

  const pickStatus = (s: AttendanceStatus) => {
    setSelectedStatus(s);
    onSelectionChange?.(worker.id, s);
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
                  onClick={() => pickStatus(status)}
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

          {(currentAdvance || 0) > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              एडवांस: ₹{currentAdvance}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}