import React, { useState, useEffect } from 'react';

interface DiagnosticState {
  status: 'checking' | 'available' | 'failed';
  message: string;
  httpStatus?: number;
  hasPackageName?: boolean;
}

export const AppLinksDiagnostic: React.FC = () => {
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>({
    status: 'checking',
    message: 'ashapurapro.com की जाँच की जा रही है...',
  });

  const runCheck = async () => {
    setDiagnostic({
      status: 'checking',
      message: 'ashapurapro.com की जाँच की जा रही है...',
    });

    try {
      const response = await fetch(
        'https://ashapurapro.com/.well-known/assetlinks.json'
      );

      if (response.status === 200) {
        try {
          const json = await response.json();
          const hasAppConfig = Array.isArray(json) && json.some((entry: any) => {
            const target = entry?.target;
            return target?.namespace === 'android_app' && target?.package_name === 'com.ashapurasamrat.app';
          });

          setDiagnostic({
            status: 'available',
            httpStatus: 200,
            hasPackageName: hasAppConfig,
            message: 'Asset Links फ़ाइल उपलब्ध है — HTTP 200; (वास्तविक Android Verification अलग से Google Play Console में जाँचें)',
          });
        } catch (jsonErr) {
          setDiagnostic({
            status: 'available',
            httpStatus: 200,
            message: 'फ़ाइल मिली (HTTP 200), लेकिन JSON फ़ॉर्मेट मान्य नहीं है।',
          });
        }
      } else {
        setDiagnostic({
          status: 'failed',
          httpStatus: response.status,
          message: `सर्वर एरर: HTTP स्टेटस ${response.status}`,
        });
      }
    } catch (err) {
      setDiagnostic({
        status: 'failed',
        message: 'नेटवर्क/CORS एरर: डोमेन तक fetch() नहीं पहुँच सका या ब्राउज़र ने ब्लॉक किया।',
      });
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🔗 App Links Diagnostic (ashapurapro.com)</h2>
      <p style={{ color: '#555', fontSize: '14px' }}>
        यह टूल <strong>ashapurapro.com</strong> के <code>assetlinks.json</code> फ़ाइल की उपलब्धता और सामग्री की जाँच करता है।
      </p>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '16px',
          backgroundColor:
            diagnostic.status === 'available'
              ? '#e6fffa'
              : diagnostic.status === 'failed'
              ? '#fff5f5'
              : '#f7fafc',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>ashapurapro.com</strong>
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#fff',
              backgroundColor:
                diagnostic.status === 'available'
                  ? '#319795'
                  : diagnostic.status === 'failed'
                  ? '#e53e3e'
                  : '#d69e2e',
            }}
          >
            {diagnostic.status === 'available' && 'Asset Links Available'}
            {diagnostic.status === 'failed' && 'Failed / Unavailable'}
            {diagnostic.status === 'checking' && 'Checking...'}
          </span>
        </div>

        <p style={{ marginTop: '12px', marginBottom: '8px', fontWeight: '500', color: '#2d3748' }}>
          {diagnostic.message}
        </p>

        {diagnostic.httpStatus && (
          <div style={{ fontSize: '13px', color: '#4a5568', marginTop: '4px' }}>
            • HTTP Status: <code>{diagnostic.httpStatus}</code>
            {diagnostic.hasPackageName !== undefined && (
              <div style={{ marginTop: '2px' }}>
                • Package Match (`com.ashapurasamrat.app`): {diagnostic.hasPackageName ? '✅ हाँ' : '❌ नहीं'}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={runCheck}
        style={{
          padding: '10px 16px',
          backgroundColor: '#3182ce',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '24px',
          fontWeight: 'bold',
        }}
      >
        Re-check Status
      </button>

      <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
        <h3>🛠️ समस्या निवारण के कदम</h3>
        <ol style={{ lineHeight: '1.6', paddingLeft: '20px', color: '#2d3748' }}>
          <li>
            <strong>Android Settings में जाँचें:</strong>
            <br />
            अपने फोन पर <em>Settings &gt; Apps &gt; Ashapura Samrat &gt; Open by default</em> में जाकर <strong>"Open supported links"</strong> इनेबल करें।
          </li>
          <li>
            <strong>Play Console Recheck:</strong>
            <br />
            Google Play Console पर नया APK/AAB अपलोड करने के बाद "Recheck verification" पर क्लिक करें।
          </li>
        </ol>
      </div>
    </div>
  );
};
          
