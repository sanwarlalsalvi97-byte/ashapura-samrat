# साइटें Cloud में सेव करना — जाँच रिपोर्ट और योजना

यह सिर्फ़ जाँच (READ-ONLY AUDIT) और योजना है। आपकी मंज़ूरी के बिना कुछ भी लागू नहीं होगा।

## भाग A — अभी ऐप कैसे काम करता है (जाँच के नतीजे)

**साइटें कहाँ सेव होती हैं**
- `src/lib/sites.ts` सिर्फ़ फ़ोन की memory (localStorage) में `ashapura-samrat-sites-v2` नाम से सेव करता है। पुराने ढंग के लिए `ashapura-samrat-sites` में भी नामों की एक कॉपी रखी जाती है।
- हर साइट में ये रहता है: `id` (`site_<समय>_<random>`, यह UUID नहीं है), `name`, `location` (स्क्रीन पर इसे "मालिक का नाम" कहा गया है), `isActive`, `createdAt`, `updatedAt`।
- `createSite()` (135-151): नाम को trim करता है, एक जैसे नाम पर रोक लगाता है (case का फ़र्क़ नहीं देखता), पहली साइट को अपने-आप "चालू" कर देता है, फिर `write()` चलाता है।
- `write()` (118-123): दोनों keys लिखता है और `emit()` से सूचना भेजता है (`sites-updated` event + subscribers)।
- `listSites()` (126): `read()` से पढ़ता है, जो पढ़ते समय सफ़ाई भी करता है: " · " को तोड़कर नाम और मालिक अलग करता है, नाम trim करता है, और case का फ़र्क़ छोड़कर duplicate हटाता है। ये बदलाव localStorage में वापस लिख दिए जाते हैं।
- `mergeSitesFrom()` (204) मौजूद है, पर `src` में इसका कहीं इस्तेमाल नहीं मिला।
- सारा काम synchronous है और database से कोई संबंध नहीं।

**साइट-सूची इस्तेमाल करने वाली 10 जगहें**
- `SitesPage`, `SiteNameInput`, `HomePage`, `AttendanceCard`, `WorkersPage`, `PendingPaymentsPage`, `WorkerExpensesPage`, `ReportPage`, `PaymentHistoryPage`, `MaterialEntryPage`।
- `AttendanceCard` और `WorkersPage` भी `createSite()` चलाते हैं।
- सब एक synchronous तरीक़ा मानकर लिखे गए हैं, इसलिए बदलाव पीछे के हिस्से (`sites.ts`) में करना सबसे सुरक्षित है।

**site_name का संबंध**
- लगभग 30 फ़ाइलें `site_name` text इस्तेमाल करती हैं: workers, attendance, payment_history, worker_expenses, cashbook, brick_stock, contractors, material_entries, reports और payment-engine।
- यह साइट से कोई पक्का जोड़ (ID) नहीं है, सिर्फ़ नाम का text है। इसलिए साइट हटाने या उसका नाम बदलने पर पुराने रिकॉर्ड नहीं बदलते।
- ये रिकॉर्ड जैसे हैं वैसे ही रहेंगे।

**Login का तरीक़ा**
- ऐप में हर जगह `supabase.auth.getUser()` से `user.id` लिया जाता है, जैसे `supabase-helpers.ts:33`, `backup.ts` और `reset-app.ts`।
- Database की बाकी tables में RLS नियम `auth.uid() = user_id` है, और INSERT/UPDATE पर `WITH CHECK` भी (workers और material_entries में जाँचा गया)।
- `supabase/migrations` में 37 migration फ़ाइलें हैं।
- अभी `sites` नाम की कोई table नहीं है।

**Backup, Restore और Reset — जाँच में मिली अहम बातें**
- `backup.ts:30`: साइटें backup में `preferences["ashapura-samrat-sites-v2"]` के रूप में JSON text बनकर जाती हैं।
- `restoreBackup()` (160-204) पहले database की tables का पूरा डेटा मिटाता है, फिर backup डालता है। आख़िर में preferences को **सीधे ऊपर लिख देता है**, जिससे backup के बाद जोड़ी गई साइटें अभी भी चुपचाप मिट सकती हैं। यह पहले से मौजूद समस्या है।
- `reset-app.ts:35` पर `clearAllCaches()` localStorage साफ़ कर देता है, जिससे साइटें मिट जाती हैं। Settings में यह `SettingsPage.tsx:982` से चलता है।
- `resetAllUserData()` (Settings 1009) 7 tables का डेटा मिटाता है। इसमें साइटें शामिल नहीं हैं।

**अकाउंट बदलने का जोखिम (अभी भी मौजूद)**
- localStorage की key किसी user से जुड़ी नहीं है। इसलिए एक ही फ़ोन पर दूसरे अकाउंट से login करने पर पहले अकाउंट की साइटें दिखती हैं।
- यही वजह है कि फ़ोन की साइटें बिना पुष्टि के अपने-आप cloud में नहीं भेजी जाएँगी।

## भाग B — प्रस्तावित Database डिज़ाइन

```sql
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  legacy_local_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sites_name_not_blank CHECK (length(btrim(name)) > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sites"   ON public.sites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own sites"    ON public.sites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sites" ON public.sites FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sites" ON public.sites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Same user cannot have two sites whose names differ only by case/extra spaces
CREATE UNIQUE INDEX sites_user_name_unique
  ON public.sites (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
-- Makes the local-to-cloud import repeatable without duplicates
CREATE UNIQUE INDEX sites_user_legacy_unique
  ON public.sites (user_id, legacy_local_id) WHERE legacy_local_id IS NOT NULL;
CREATE INDEX sites_user_id_idx ON public.sites (user_id);

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**आपके प्रस्ताव से दो जानबूझकर किए गए अंतर**
1. `user_id` पर `auth.users` का foreign key नहीं लगेगा। इस project का नियम है कि नई tables में user ID सादा UUID रहे। सुरक्षा पूरी तरह RLS (`auth.uid() = user_id`) से server पर ही होगी।
2. `owner_name` और `is_active` columns जोड़े गए हैं, क्योंकि अभी की स्क्रीन पर "मालिक का नाम" और "चालू साइट" दोनों दिखते हैं।

**सुरक्षा**
- service_role key frontend में कभी इस्तेमाल नहीं होगी।
- किसी दूसरे user का `user_id` भेजा गया तो `WITH CHECK` उसे रोक देगा।
- पुराने रिकॉर्ड की कोई table नहीं बदली जाएगी। कुछ भी delete या truncate नहीं होगा।

## भाग C — फ़ोन की मौजूदा साइटों को cloud में ले जाना

1. localStorage का मूल डेटा पढ़ा जाएगा, पर बदला नहीं जाएगा।
2. Import से पहले मूल डेटा की एक अलग कॉपी बनेगी: `ashapura-samrat-sites-v2.premigration.<userId>.<समय>`। पुराना backup overwrite नहीं होगा।
3. Login के बाद, अगर फ़ोन में ऐसी साइटें हैं जो cloud में नहीं हैं, तो एक **पुष्टि वाली खिड़की** खुलेगी:
   - "इस फ़ोन पर N साइटें मिलीं (नामों की सूची)। क्या इन्हें इस अकाउंट (ईमेल) में सेव करें?"
   - विकल्प होंगे: हाँ / अभी नहीं / नहीं।
   - बिना पुष्टि के कोई bulk import नहीं होगा।
4. खाली नाम और duplicate नाम सूची में अलग से दिखाए जाएँगे। कोई साइट चुपचाप नहीं हटेगी।
5. Import में `legacy_local_id` के साथ upsert होगा (`ON CONFLICT DO NOTHING`), इसलिए दोबारा चलाने पर duplicate नहीं बनेंगे।
6. जिस नाम की साइट पहले से cloud में है, उसे "पहले से मौजूद" दिखाया जाएगा।
7. `user_id` हमेशा server पर `auth.uid()` से तय होगा, फ़ोन से नहीं भेजा जाएगा।
8. Import के बाद फ़ोन और cloud की गिनती और नामों का मिलान होगा। तभी उस अकाउंट के लिए "import हो गया" का निशान लगेगा।
9. फ़ोन की मूल साइटें **नहीं हटेंगी**।
10. Import fail हुआ तो मूल डेटा वैसा ही रहेगा और "फिर से कोशिश करें" का विकल्प मिलेगा।
11. Logs में साइटों के नाम नहीं लिखे जाएँगे, सिर्फ़ गिनती।
12. workers और दूसरी tables के `site_name` नहीं बदले जाएँगे।

**Rollback (पुरानी व्यवस्था पर लौटना)**
- नई table अलग से जुड़ती है, इसलिए ऐप का कोड पुराने localStorage तरीक़े पर लौटाया जा सकता है।
- मूल डेटा और उसकी कॉपी दोनों फ़ोन पर सुरक्षित रहेंगी।
- table को हटाना (drop) तभी होगा जब आप अलग से अनुमति दें।

## भाग D — ऐप में बदलाव

- `src/lib/sites.ts`
  - **Cloud-first, local cache**: सूची याद में (memory) रखी जाएगी, ताकि `listSites()` अभी की तरह तुरंत काम करता रहे। सूची cloud से आएगी।
  - Cache की key हर user के लिए अलग होगी: `ashapura-samrat-sites-cache.<userId>`।
  - `createSite`, `updateSite`, `deleteSite` और `setActiveSite` async हो जाएँगे। Cloud से सफलता का जवाब आने के बाद ही सूची refresh होगी।
  - Duplicate नाम पर database के unique नियम वाला error (23505) आने पर संदेश दिखेगा: "यह साइट पहले से मौजूद है"।
  - एक साइट को "चालू" करने पर बाकी साइटें बंद की जाएँगी।
- Login बदलने पर (auth state change): पिछले user की सूची memory से साफ़ होगी, फिर नए user की सूची लोड होगी।
- `SitesPage.tsx`: लोडिंग, error और "फिर से कोशिश करें" की स्थिति दिखेगी। Save के दौरान बटन बंद रहेगा ताकि दो बार दबाने पर duplicate न बने।
- `SiteNameInput.tsx`: वही सूची इस्तेमाल करेगा, और लोड होते समय "लोड हो रहा है" दिखाएगा।
- `AttendanceCard.tsx` और `WorkersPage.tsx`: `createSite()` को await करेंगे।
- बाकी 6 जगहों पर कोई बदलाव नहीं, क्योंकि वे सिर्फ़ `listSites()` पढ़ती हैं।

## भाग E — Offline व्यवहार

- नेटवर्क न होने पर उस user की आख़िरी cache वाली सूची दिखेगी, साथ में संदेश: "ऑफ़लाइन — सूची पुरानी हो सकती है"।
- ऑफ़लाइन नई साइट जोड़ने पर वह pending queue (`sites-pending.<userId>`) में जाएगी:
  - साइट पर "सिंक बाकी" का निशान दिखेगा।
  - उसे फ़ोन पर ही बना UUID मिलेगा, इसलिए retry करने पर duplicate नहीं बनेगा (`upsert ... ON CONFLICT (id)`)।
- Queue उसी user की होगी। sync तभी होगा जब login वाला user वही हो, वरना queue रुकी रहेगी।
- Cloud में उसी नाम की साइट पहले से हो तो conflict बताया जाएगा। कुछ भी चुपचाप overwrite या delete नहीं होगा।
- "Cloud में सेव हुआ" तभी दिखेगा जब server से पुष्टि आ जाए।
- Offline queue के लिए कोई अतिरिक्त schema नहीं चाहिए।

## भाग F — Backup, Restore और Reset

- Backup का format वही रहेगा। साथ में `data.sites` (cloud की rows) भी जोड़ी जाएँगी, जिससे पुराने backup भी पढ़े जा सकेंगे।
- Restore के समय साइटें **merge** होंगी, delete नहीं:
  - backup की साइटें (पुराने backup में preferences वाली साइटें भी) नाम के हिसाब से मिलाई जाएँगी।
  - सिर्फ़ नई साइटें जोड़ी जाएँगी।
  - duplicate साइटों की गिनती दिखाई जाएगी।
  - Cloud की मौजूदा साइटें नहीं मिटेंगी।
- साइट वाली preference key restore करते समय सीधे overwrite नहीं होगी। यह अभी की चुपचाप डेटा मिटने वाली समस्या भी ठीक करेगा।
- "Cache साफ़ करें" से सिर्फ़ फ़ोन की cache साफ़ होगी। Cloud की साइटें बची रहेंगी और दोबारा लोड हो जाएँगी।
- `resetAllUserData` में साइटें **डिफ़ॉल्ट रूप से शामिल नहीं होंगी**। उन्हें तभी हटाया जाएगा जब आप इसके लिए अलग से साफ़ विकल्प चाहें।

## भाग G — परीक्षण

**Automatic tests (vitest, mock से), इस पर लिखे जाएँगे:**
- नाम की तुलना (case और spaces)
- duplicate पहचानना
- import दोबारा चलाने पर duplicate न बनना (idempotent)
- import fail होने पर मूल डेटा सुरक्षित रहना
- अकाउंट बदलने पर cache का अलग रहना
- offline queue का retry
- restore में merge, कुछ न मिटना
- cache clear के बाद cloud से दोबारा लोड होना

**Database (RLS) की जाँच:**
- `pg_policies` पढ़कर नियमों की पुष्टि।
- दूसरे user की rows पढ़ने या बदलने पर रोक की जाँच, केवल आपकी अनुमति से और test rows के साथ।

**Linter और checks:** database linter, type-check, `bunx vitest run` और preview build।

**फ़ोन पर manual जाँच:**
- साइट जोड़ना, ऐप बंद करके खोलना
- दूसरे फ़ोन पर उसी अकाउंट से साइट दिखना
- दूसरे user को साइटें न दिखना
- offline से online आने पर sync
- पुराने backup का restore
- पुराने `site_name` वाली reports का सही रहना

**अभी क्या चलाया गया:** इस जाँच में कोई test नहीं चलाया गया। सिर्फ़ फ़ाइलें और database के नियम पढ़े गए।
- अभी 13 test files मौजूद हैं, पर उनमें साइटों का कोई test नहीं है।
- Logs उपलब्ध नहीं थे।

## जोखिम और खुले सवाल

1. फ़ोन की साइटें किस अकाउंट की हैं, यह तय नहीं हो सकता। इसलिए हर बार पुष्टि वाली खिड़की ज़रूरी है।
2. Async सूची पर जाने से 10 जगहों पर पहली बार लोड होने में देरी दिख सकती है। Cache से यह कम होगी।
3. नाम बदलने पर पुराने रिकॉर्ड का `site_name` नहीं बदलेगा। यह अभी भी ऐसा ही है।
4. `resetAllUserData` (सारा डेटा मिटाएँ) में साइटें हटें या नहीं? सुझाव: नहीं।
5. "मालिक का नाम" cloud में सेव हो? सुझाव: हाँ।

## तकनीकी विवरण — बदली जाने वाली फ़ाइलें

- नई migration: `public.sites`, जैसा ऊपर लिखा है
- `src/lib/sites.ts` (मुख्य बदलाव), नई `src/lib/sites-sync.ts` (import और queue)
- `src/components/SitesPage.tsx`, `SiteNameInput.tsx`, `AttendanceCard.tsx`, `WorkersPage.tsx`
- `src/lib/backup.ts` (merge restore), `src/lib/reset-app.ts` (cache की user-scoped key को बचाना ज़रूरी नहीं)
- नया test: `src/test/sites-cloud.test.ts`
- `src/integrations/supabase/types.ts`: अपने-आप दोबारा बनेगी
- `AGENTS.md`: एक नियम जुड़ेगा

ये नहीं छुए जाएँगे: Attendance, Advance, Payment, Add Worker, Google Login, Play Billing।
