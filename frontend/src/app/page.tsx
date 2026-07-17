'use client';

import Link from 'next/link';
import { Kanban, Users, Bell, Globe, ArrowRight, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useT } from '@/lib/i18n/useT';

const FEATURE_ICONS = [Kanban, Users, Bell, Globe];

export default function LandingPage() {
  const t = useT();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Kanban className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl hidden sm:inline">TeamFlow</span>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-2 flex-shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />
            <span className="w-px h-6 bg-border mx-1 hidden sm:block" />
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-secondary transition-colors hidden sm:inline-block"
            >
              {t.landing.navSignIn}
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">{t.landing.navGetStartedShort}</span>
              <span className="hidden sm:inline">{t.landing.navGetStartedFull}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <span className="h-1.5 w-1.5 bg-primary rounded-full" />
          {t.landing.badge}
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          {t.landing.heroLine1}
          <br />
          <span className="text-primary">TeamFlow</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          {t.landing.heroSubtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            {t.landing.ctaStart} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 border border-border hover:border-foreground/30 text-foreground font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            {t.landing.ctaSignIn}
          </Link>
        </div>
        <Link
          href="/forgot-password"
          className="inline-block mt-5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t.landing.forgotPassword}
        </Link>
      </section>

      {/* Features */}
      <section className="bg-secondary/40 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">{t.landing.featuresHeading}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.landing.features.map(({ title, desc }, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={title} className="card p-6">
                  <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">{t.landing.perksHeading}</h2>
            <p className="text-muted-foreground mb-8">{t.landing.perksSubtitle}</p>
            <ul className="space-y-3">
              {t.landing.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-foreground">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-app p-8 text-white"
            style={{ backgroundImage: 'var(--gradient-signature)' }}
          >
            <h3 className="text-2xl font-bold mb-2">{t.landing.ctaPanelHeading}</h3>
            <p className="text-white/80 mb-6">{t.landing.ctaPanelSubtitle}</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
            >
              {t.landing.ctaPanelButton} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-primary rounded flex items-center justify-center">
              <Kanban className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">TeamFlow</span>
          </div>
          <p className="text-xs text-muted-foreground">{t.landing.footerTagline}</p>
        </div>
      </footer>
    </div>
  );
}
