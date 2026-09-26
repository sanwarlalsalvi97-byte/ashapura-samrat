# OTP दोबारा भेजने की सुविधा

## बदलाव
- गलत या विफल OTP पुष्टि के बाद उपयोगकर्ता को स्पष्ट हिंदी स्थिति संदेश दिखाना।
- OTP स्क्रीन पर “OTP दोबारा भेजें” विकल्प जोड़ना।
- हर OTP भेजने के बाद 30 सेकंड का countdown cooldown रखना, ताकि बार-बार अनुरोध न हों।
- resend करते समय reCAPTCHA को सुरक्षित रूप से रीसेट करके नया OTP confirmation session सहेजना।
- OTP सत्यापन और resend के दौरान buttons की loading/disabled स्थिति सही रखना।

## जाँच
- TypeScript जाँच और live preview build सत्यापित करना।
