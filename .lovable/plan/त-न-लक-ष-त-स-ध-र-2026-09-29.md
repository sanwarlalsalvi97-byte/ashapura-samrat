# तीन लक्षित सुधार

## बदलाव
- मुख्य ऐप header को status bar/notch के नीचे रखने के लिए safe-area top padding जोड़ना।
- सार्वजनिक `/` page पर session जाँच और auth-state listener जोड़कर logged-in users को मौजूदा app dashboard `/app` पर भेजना।
- shared input में text input mode, autocomplete/autocorrect off और spellcheck off को base defaults बनाना।

## सीमा और जाँच
- केवल `src/pages/Index.tsx`, `src/pages/LandingPage.tsx`, और `src/components/ui/input.tsx` बदलेंगे।
- TypeScript और preview build status से बदलाव सत्यापित करेंगे।
