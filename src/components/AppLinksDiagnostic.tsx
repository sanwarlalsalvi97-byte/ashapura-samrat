import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DOMAIN = 'ashapurapro.com';
const ASSET_URL = `https://${DOMAIN}/.well-known/assetlinks.json`;
const PACKAGE_NAME = 'com.ashapura.samrat';

type CheckState = 'checking' | 'pass' | 'fail';
interface CheckItem { label: string; state: CheckState; detail?: string }

const initial: CheckItem[] = [
  { label: 'फ़ाइल खुलती है (HTTP 200)', state: 'checking' },
  { label: 'फ़ाइल का JSON सही है', state: 'checking' },
  { label: `ऐप का नाम मेल खाता है (${PACKAGE_NAME})`, state: 'checking' },
  { label: 'ऐप की पहचान (fingerprint) मौजूद है', state: 'checking' },
];

export const AppLinksDiagnostic: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CheckItem[]>(initial);
  const [checkedAt, setCheckedAt] = useState<string>('');

  const runCheck = useCallback(async () => {
    setItems(initial);
    const next: CheckItem[] = initial.map((i) => ({ ...i, state: 'fail' as CheckState }));
    try {
      const res = await fetch(`${ASSET_URL}?t=${Date.now()}`, { cache: 'no-store' });
      next[0] = { ...next[0], state: res.ok ? 'pass' : 'fail', detail: `HTTP ${res.status}` };
      if (res.ok) {
        try {
          const json: unknown = await res.json();
          next[1] = { ...next[1], state: Array.isArray(json) ? 'pass' : 'fail' };
          const entry = Array.isArray(json)
            ? json.find((e: { target?: { namespace?: string; package_name?: string } }) =>
                e?.target?.namespace === 'android_app' && e?.target?.package_name === PACKAGE_NAME)
            : undefined;
          next[2] = { ...next[2], state: entry ? 'pass' : 'fail' };
          const fps: unknown = entry?.target?.sha256_cert_fingerprints;
          const count = Array.isArray(fps) ? fps.length : 0;
          next[3] = { ...next[3], state: count > 0 ? 'pass' : 'fail', detail: `${count} मिले` };
        } catch {
          next[1] = { ...next[1], detail: 'JSON पढ़ा नहीं जा सका' };
        }
      }
    } catch {
      next[0] = { ...next[0], detail: 'इंटरनेट या ब्राउज़र ने जाँच रोकी' };
    }
    setItems(next);
    setCheckedAt(new Date().toLocaleTimeString('hi-IN'));
  }, []);

  useEffect(() => { runCheck(); }, [runCheck]);

  const checking = items.some((i) => i.state === 'checking');
  const allPass = !checking && items.every((i) => i.state === 'pass');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl space-y-4 p-4 pb-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="वापस">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">App Links जाँच</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          यह पेज देखता है कि <strong>{DOMAIN}</strong> के लिंक सीधे Ashapura Samrat ऐप में खुलने के लिए तैयार हैं या नहीं।
        </p>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <strong>{DOMAIN}</strong>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              checking ? 'bg-muted text-muted-foreground'
                : allPass ? 'bg-primary text-primary-foreground'
                : 'bg-destructive text-destructive-foreground'}`}>
              {checking ? 'जाँच जारी...' : allPass ? 'तैयार' : 'समस्या मिली'}
            </span>
          </div>
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.label} className="flex items-start gap-2 text-sm">
                {i.state === 'checking' && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                {i.state === 'pass' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                {i.state === 'fail' && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <span>{i.label}{i.detail && <span className="text-muted-foreground"> — {i.detail}</span>}</span>
              </li>
            ))}
          </ul>
          {checkedAt && <p className="mt-3 text-xs text-muted-foreground">आखिरी जाँच: {checkedAt}</p>}
          <Button className="mt-4 w-full" onClick={runCheck} disabled={checking}>
            <RefreshCw className="mr-2 h-4 w-4" /> फिर से जाँचें
          </Button>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">लिंक ऐप में न खुले तो ये कदम करें</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>फ़ोन में <em>Settings → Apps → Ashapura Samrat → Open by default</em> खोलें और <strong>"Open supported links"</strong> चालू करें। वहाँ <strong>{DOMAIN}</strong> पर टिक लगाएँ।</li>
            <li>Play Store से ऐप का नया version इंस्टॉल करें, फिर फ़ोन एक बार restart करें।</li>
            <li>ऊपर कोई लाल निशान हो तो वेबसाइट फिर से publish करें और कुछ मिनट बाद "फिर से जाँचें" दबाएँ।</li>
            <li>"ऐप की पहचान" लाल हो तो Play Console → App integrity → App signing से SHA-256 fingerprint लेकर फ़ाइल में जोड़वाएँ।</li>
            <li>Play Console → Deep links में <strong>{DOMAIN}</strong> के आगे "Recheck" दबाएँ। www वाला पता ऐप के लिए ज़रूरी नहीं है।</li>
          </ol>
        </section>
        <p className="text-xs text-muted-foreground">
          नोट: यह पेज वेबसाइट की फ़ाइल जाँचता है। फ़ोन पर असली verification Android खुद करता है।
        </p>
      </div>
    </div>
  );
};
