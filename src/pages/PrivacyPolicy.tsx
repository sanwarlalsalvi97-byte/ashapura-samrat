import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Shield,
  Database,
  UserCheck,
  Lock,
  MapPin,
  FileText,
  Share2,
  Mail,
  ExternalLink,
} from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="w-9 h-9 rounded-full grid place-items-center hover:bg-muted active:scale-95 transition"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">
            गोपनीयता नीति / Privacy Policy
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-12">
        <section className="rounded-2xl bg-primary/10 border border-primary/20 p-4 flex items-start gap-3">
          <Shield className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-sm">
              गोपनीयता नीति / Privacy Policy
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              This page explains how Ashapura Samrat collects, uses, and
              protects your data. It is owner-authored to match the Google Play
              Console Data safety disclosure.
            </p>
          </div>
        </section>

        <Section icon={Database} title="Data we collect / हम जो डेटा इकट्ठा करते हैं">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Account data:</b> email address, display name, and phone
              number used for login and profile.
            </li>
            <li>
              <b>Business data you enter:</b> worker names, roles, daily rates,
              attendance records, advances, sites, cashbook entries, and payment
              history.
            </li>
            <li>
              <b>Optional location data:</b> if you enable GPS punch-in/out,
              approximate latitude/longitude may be stored with the attendance
              record. This is optional and controlled by the admin.
            </li>
            <li>
              <b>Device/technical data:</b> basic device info needed for app
              functionality (OS version, screen size). We do <b>not</b>{" "}
              collect the Advertising ID.
            </li>
          </ul>
        </Section>

        <Section icon={UserCheck} title="How we use your data / डेटा का उपयोग">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              To run the app features you use: attendance, payroll, reports,
              cashbook, and backups.
            </li>
            <li>
              To keep your data synced across devices signed into the same
              account.
            </li>
            <li>To send local reminders if you enable the attendance alarm.</li>
            <li>
              We do <b>not</b> sell, rent, or share your data with advertisers
              or data brokers.
            </li>
          </ul>
        </Section>

        <Section icon={Lock} title="Data sharing & hosting / डेटा साझा करना और होस्टिंग">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Your data is stored on Lovable Cloud (powered by Supabase), which
              provides encrypted connections (HTTPS/TLS) and Row-Level Security
              so each user can access only their own records.
            </li>
            <li>
              Optional Google Drive backups are saved to your own Google Drive
              in a private folder.
            </li>
            <li>
              We do not share data with any other third parties except as
              required to operate these services.
            </li>
          </ul>
        </Section>

        <Section icon={MapPin} title="Location / लोकेशन">
          <p>
            GPS-based punch attendance is optional. When enabled, the app checks
            whether the device is within the configured office/site radius
            (default 50 meters). Coordinates are stored only when a punch is
            recorded and are visible to the account owner.
          </p>
        </Section>

        <Section icon={FileText} title="Data safety disclosure (Play Console) / डेटा सेफ्टी डिस्क्लोज़र">
          <div className="space-y-2">
            <p className="font-semibold text-xs">Collected data types:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Name, email address, phone number — for authentication and
                profile.
              </li>
              <li>App-generated business records — entered by the user.</li>
              <li>
                Approximate location — only when GPS attendance is enabled.
              </li>
              <li>
                Device or other IDs — <b>not collected</b>. Advertising ID is
                not used.
              </li>
            </ul>
            <p className="font-semibold text-xs pt-1">Purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>App functionality and account management.</li>
              <li>Backup and sync.</li>
              <li>Security and fraud prevention (authentication).</li>
            </ul>
            <p className="font-semibold text-xs pt-1">Data handling:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Data is encrypted in transit.</li>
              <li>Data is not sold or shared for advertising.</li>
              <li>Users can export or delete their data (see below).</li>
            </ul>
          </div>
        </Section>

        <Section icon={Share2} title="Your choices / आपके विकल्प">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Export:</b> use Settings → Data Export or Backup to download
              your records.
            </li>
            <li>
              <b>Delete:</b> use Settings → Reset app data to remove local
              records, or contact support to request full account deletion.
            </li>
            <li>
              <b>Opt-out of location:</b> disable GPS punch-in or deny location
              permission in your device settings.
            </li>
          </ul>
        </Section>

        <Section icon={Lock} title="Security / सुरक्षा">
          <ul className="list-disc pl-5 space-y-1">
            <li>Secure email/OTP-based sign-in with session tokens.</li>
            <li>
              Role-based access: admin accounts manage data; linked worker
              accounts are read-only.
            </li>
            <li>Optional PIN lock to protect app access.</li>
            <li>
              Database Row-Level Security prevents one account from accessing
              another account's data.
            </li>
          </ul>
        </Section>

        <Section icon={Mail} title="Contact us / संपर्क करें">
          <p>
            For privacy questions, data deletion requests, or security reports,
            contact the app owner through the in-app support option in Settings,
            or email{" "}
            <a
              href="mailto:support@ashapurapro.com"
              className="text-primary underline inline-flex items-center gap-1"
            >
              support@ashapurapro.com
              <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
        </Section>

        <footer className="rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground">
            Last updated / अंतिम अपडेट: 18 August 2026
          </p>
          <p className="mt-1">
            This policy is provided by the Ashapura Samrat app owner. Platform
            infrastructure is provided by Lovable Cloud; the owner remains
            responsible for how customer data is handled inside the app.
          </p>
        </footer>
      </main>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed">
        {children}
      </div>
    </Card>
  );
}
