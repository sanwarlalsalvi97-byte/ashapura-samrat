import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Shield, Lock, Database, UserCheck, Mail, ArrowLeft } from "lucide-react";

export default function Trust() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/" className="w-9 h-9 rounded-full grid place-items-center hover:bg-muted active:scale-95 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">Trust & Security</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-12">
        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 flex items-start gap-3">
          <Shield className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-sm">सुरक्षा और गोपनीयता / Security & Privacy</h2>
            <p className="text-xs text-muted-foreground mt-1">
              This page is maintained by the Ashapura Samrat app owner to answer common security and privacy
              questions. It is editable content, not an independent certification or audit.
            </p>
          </div>
        </div>

        <Section icon={UserCheck} title="Access & Authentication">
          <ul className="list-disc pl-5 space-y-1">
            <li>Sign-in is required to access attendance, cashbook, workers, and reports.</li>
            <li>Email/password authentication with secure session handling.</li>
            <li>Role-based access (admin / staff) controls sensitive actions.</li>
          </ul>
        </Section>

        <Section icon={Database} title="Data Collection & Use">
          <ul className="list-disc pl-5 space-y-1">
            <li>We store the data you enter: workers, attendance, sites, advances, and cashbook entries.</li>
            <li>If you enable GPS, the approximate coordinates may be saved with attendance entries.</li>
            <li>Your data is used only to operate the app for your account and is not sold.</li>
          </ul>
        </Section>

        <Section icon={Lock} title="Platform & Hosting">
          <ul className="list-disc pl-5 space-y-1">
            <li>The app is built on Lovable Cloud (powered by Supabase) for database, auth, and storage.</li>
            <li>Row-Level Security policies restrict each user to their own records.</li>
            <li>Data is transmitted over HTTPS/TLS.</li>
          </ul>
          <p className="text-[11px] text-muted-foreground mt-2">
            Lovable platform capabilities are described factually here and are not a certification.
          </p>
        </Section>

        <Section icon={Shield} title="Retention & Deletion">
          <ul className="list-disc pl-5 space-y-1">
            <li>Your records are retained while your account is active.</li>
            <li>To request deletion of your account or data, contact the app owner below.</li>
          </ul>
        </Section>

        <Section icon={Mail} title="Contact / Security Reports">
          <p>
            To report a security concern or make a privacy request, contact the app owner through the
            in-app support option in Settings.
          </p>
        </Section>

        <div className="rounded-xl bg-muted/50 p-3 text-[11px] text-muted-foreground">
          Shared responsibility: Lovable provides platform infrastructure; the app owner is responsible for
          how the app is configured and how customer data is handled within it.
        </div>
      </main>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">{children}</div>
    </Card>
  );
}
