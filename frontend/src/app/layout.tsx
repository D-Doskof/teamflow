import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Google's subset list for this font exposes Cyrillic only as 'cyrillic-ext' (there's
// no separate plain 'cyrillic' key) — that subset covers the Russian alphabet the app
// needs for its ru locale, so it's included alongside latin/latin-ext.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'TeamFlow — Project Management',
  description: 'Collaborate on projects with your team',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TeamFlow',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#5C6B39',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning className={jakarta.variable}>
      <head>
        {/* Next's `appleWebApp` metadata only emits the modern `mobile-web-app-capable` tag —
            older iOS Safari versions specifically look for this legacy Apple-prefixed one to
            enable standalone (no browser chrome) mode when added to the home screen. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* App has its own EN/RU/PL i18n — block Google Translate to avoid it mutating the DOM before React hydrates */}
        <meta name="google" content="notranslate" />
        {/* Prevent flash of wrong theme/accent, mirroring theme.store.ts's
            applyThemeAndAccent. Presets are covered by CSS (dark class + data-accent);
            accent === 'custom' needs inline styles computed here, duplicating the formula
            in lib/theme-tokens.ts's deriveCustomTokens so it can run before the JS bundle
            loads — keep the two in sync if that recipe ever changes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var t=JSON.parse(localStorage.getItem('teamflow-theme')||'{}');
              var s=t.state||{};
              var isDark=s.theme==='dark';
              var root=document.documentElement;
              if(isDark)root.classList.add('dark');
              var accent=s.accent||'olive';
              if(accent!=='custom'){
                root.dataset.accent=accent;
              } else {
                var hue=typeof s.customHue==='number'?((s.customHue%360)+360)%360:150;
                var L=isDark?[hue,20,7]:[hue,25,97];
                var F=isDark?[hue,12,92]:[hue,18,14];
                var C=isDark?[hue,16,11]:[hue,15,99];
                var P=isDark?[hue,32,60]:[hue,35,40];
                var PF=isDark?[hue,20,10]:[hue,15,98];
                var SE=isDark?[hue,15,17]:[hue,18,93];
                var SEF=isDark?[hue,12,90]:[hue,18,20];
                var M=isDark?[hue,15,15]:[hue,18,94];
                var MF=isDark?[hue,8,62]:[hue,8,42];
                var B=isDark?[hue,15,21]:[hue,18,88];
                function h(a){return a[0]+' '+a[1]+'%'+' '+a[2]+'%';}
                var vars={background:L,foreground:F,card:C,'card-foreground':F,primary:P,'primary-foreground':PF,secondary:SE,'secondary-foreground':SEF,muted:M,'muted-foreground':MF,accent:P,'accent-foreground':PF,border:B,ring:P};
                for(var k in vars)root.style.setProperty('--'+k,h(vars[k]));
              }
            }catch(e){}})()`,
          }}
        />
        {/* Chrome injects __gcruniqueid/__gchrome_uniqueid attributes before React hydrates, causing
            false-positive hydration mismatches (vercel/next.js#77710). Strip them as they appear. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              function isInjected(name){ return name.indexOf('__gcruniqueid') === 0 || name.indexOf('__gchrome_uniqueid') === 0; }
              function strip(el){
                if(!el || el.nodeType !== 1) return;
                for (var i = el.attributes.length - 1; i >= 0; i--) {
                  if (isInjected(el.attributes[i].name)) el.removeAttribute(el.attributes[i].name);
                }
              }
              strip(document.documentElement);
              strip(document.body);
              var obs = new MutationObserver(function(mutations){
                mutations.forEach(function(m){
                  if (m.type === 'attributes' && isInjected(m.attributeName)) m.target.removeAttribute(m.attributeName);
                });
              });
              obs.observe(document.documentElement, { attributes: true, subtree: true });
              setTimeout(function(){ obs.disconnect(); }, 5000);
            })()`,
          }}
        />
      </head>
      <body className={jakarta.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
