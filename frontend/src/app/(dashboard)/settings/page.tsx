'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Lock,
  Save,
  CheckCircle,
  User,
  Camera,
  ShieldCheck,
  ShieldOff,
  Palette,
  Mail,
  ArrowLeft,
  Rows3,
  Columns3,
  Check,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useBoardLayoutStore, type BoardLayoutMode } from '@/store/boardLayout.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { OtpInput } from '@/components/ui/OtpInput';
import { ThemePickerContent } from '@/components/ui/ThemePicker';
import { api } from '@/lib/axios';
import { cn, getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import { useSetTwoFactor, useRequestDisableTwoFactor } from '@/features/auth/hooks/useAuth';

function BigAvatar({
  name,
  avatar,
  onUpload,
}: {
  name: string;
  avatar: string | null;
  onUpload: (dataUrl: string) => Promise<void>;
}) {
  const t = useT();
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t.validation.maxFileSize);
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await onUpload(reader.result as string);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="relative group">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0 overflow-hidden"
        style={{ backgroundImage: 'var(--gradient-signature)' }}
      >
        {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : initials}
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 rounded-2xl bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium gap-1"
      >
        <Camera className="h-5 w-5" />
        {uploading ? t.settings.avatar.uploading : t.settings.avatar.upload}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// Settings-page entry point for the board-layout preference (see boardLayout.store.ts).
// Unlike ThemePickerContent, not factored out for reuse — the board-layout quick-access
// control (KanbanBoard's toolbar toggle) is a single icon button, not a shared picker body.
function BoardLayoutSection() {
  const t = useT();
  const mode = useBoardLayoutStore((s) => s.mode);
  const setMode = useBoardLayoutStore((s) => s.setMode);

  const options: Array<{
    value: BoardLayoutMode;
    icon: typeof Rows3;
    label: string;
    desc: string;
  }> = [
    {
      value: 'horizontal',
      icon: Rows3,
      label: t.boards.layout.horizontal,
      desc: t.boards.layout.horizontalDesc,
    },
    {
      value: 'vertical',
      icon: Columns3,
      label: t.boards.layout.vertical,
      desc: t.boards.layout.verticalDesc,
    },
  ];

  return (
    <div className="card p-4 sm:p-7">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Rows3 className="h-4.5 w-4.5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t.boards.layout.title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5 sm:mb-6">{t.boards.layout.subtitle}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map(({ value, icon: Icon, label, desc }) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors',
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-foreground/30',
              )}
            >
              <span className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 rounded-xl">
      <CheckCircle className="h-4 w-4 flex-shrink-0" /> {message}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const t = useT();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const setTwoFactor = useSetTwoFactor();
  const requestDisableTwoFactor = useRequestDisableTwoFactor();
  const [disableStep, setDisableStep] = useState(false);
  const [disableDigits, setDisableDigits] = useState(Array(6).fill(''));
  const [disableResendCooldown, setDisableResendCooldown] = useState(0);

  const profileForm = useForm({ defaultValues: { name: user?.name ?? '', bio: user?.bio ?? '' } });
  const passwordForm = useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>();

  const startDisableCooldown = () => {
    setDisableResendCooldown(60);
    const interval = setInterval(() => {
      setDisableResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleToggleTwoFactor = () => {
    if (user?.twoFactorEnabled) {
      // Turning 2FA off is the risk-increasing direction — require an emailed code first.
      setDisableDigits(Array(6).fill(''));
      requestDisableTwoFactor.mutate(undefined, {
        onSuccess: () => {
          setDisableStep(true);
          startDisableCooldown();
        },
      });
    } else {
      setTwoFactor.mutate({ enabled: true });
    }
  };

  const handleResendDisableCode = () => {
    if (disableResendCooldown > 0) return;
    setDisableDigits(Array(6).fill(''));
    requestDisableTwoFactor.mutate(undefined, { onSuccess: () => startDisableCooldown() });
  };

  const handleConfirmDisable = (code: string) => {
    setTwoFactor.mutate(
      { enabled: false, code },
      {
        onSuccess: () => {
          setDisableStep(false);
          setDisableDigits(Array(6).fill(''));
        },
      },
    );
  };

  const handleAvatarUpload = async (dataUrl: string) => {
    try {
      const res = await api.post('/auth/avatar', { avatar: dataUrl });
      setUser(res.data.data);
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (e) {
      console.error(getErrorMessage(e));
    }
  };

  const onProfileSubmit = async (data: { name: string; bio: string }) => {
    setProfileError('');
    try {
      const res = await api.patch('/auth/me', data);
      setUser(res.data.data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (e) {
      setProfileError(getErrorMessage(e));
    }
  };

  const onPasswordSubmit = async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setPasswordError('');
    if (data.newPassword !== data.confirmPassword) {
      setPasswordError(t.settings.password.mismatch);
      return;
    }
    try {
      await api.patch('/auth/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset();
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e) {
      setPasswordError(getErrorMessage(e));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-1">{t.settings.subtitle}</p>
      </div>

      {/* Profile card */}
      <div className="card overflow-hidden">
        {/* Top identity bar */}
        <div className="flex items-center gap-4 sm:gap-5 p-5 sm:p-7 border-b border-border bg-secondary/40">
          <BigAvatar
            name={user?.name ?? 'U'}
            avatar={user?.avatar ?? null}
            onUpload={handleAvatarUpload}
          />
          <div>
            <p className="text-xl font-bold text-foreground">{user?.name}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.settings.avatar.hint}</p>
            {avatarSuccess && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> {t.settings.avatar.success}
              </p>
            )}
          </div>
        </div>

        {/* Profile form */}
        <div className="p-4 sm:p-7">
          <div className="flex items-center gap-2.5 mb-5 sm:mb-6">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="h-4.5 w-4.5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t.settings.profile.title}</h2>
          </div>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-5">
            <Input
              label={t.settings.profile.name}
              error={profileForm.formState.errors.name?.message}
              className="text-base"
              {...profileForm.register('name', { required: t.validation.required })}
            />
            <Textarea
              label={t.settings.profile.bio}
              placeholder={t.settings.profile.bioPlaceholder}
              rows={4}
              {...profileForm.register('bio')}
            />
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
            {profileSuccess && <SuccessBanner message={t.settings.profile.success} />}
            <div className="flex justify-end pt-1">
              <Button type="submit" size="lg" isLoading={profileForm.formState.isSubmitting}>
                <Save className="h-4 w-4 mr-2" /> {t.settings.profile.save}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Appearance card */}
      <div className="card p-4 sm:p-7">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Palette className="h-4.5 w-4.5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t.theme.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5 sm:mb-6">{t.theme.subtitle}</p>
        <ThemePickerContent />
      </div>

      {/* Board layout card */}
      <BoardLayoutSection />

      {/* 2FA card */}
      <div className="card p-4 sm:p-7">
        <div className="flex items-center gap-2.5 mb-5 sm:mb-6">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t.settings.twoFactor.title}</h2>
          </div>
        </div>

        {disableStep ? (
          <div className="space-y-5">
            <button
              onClick={() => {
                setDisableStep(false);
                setDisableDigits(Array(6).fill(''));
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t.common.back}
            </button>

            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t.settings.twoFactor.checkEmail}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t.settings.twoFactor.codeSentTo(user?.email ?? '')}
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <OtpInput
                value={disableDigits}
                onChange={setDisableDigits}
                onComplete={handleConfirmDisable}
                disabled={setTwoFactor.isPending}
              />
            </div>

            {setTwoFactor.error && (
              <p className="text-sm text-destructive text-center">
                {getErrorMessage(setTwoFactor.error)}
              </p>
            )}

            <Button
              className="w-full"
              isLoading={setTwoFactor.isPending}
              disabled={disableDigits.join('').length !== 6}
              onClick={() => handleConfirmDisable(disableDigits.join(''))}
            >
              {t.common.confirm}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              {t.settings.twoFactor.didntGetCode}{' '}
              {disableResendCooldown > 0 ? (
                <span className="text-muted-foreground">
                  {t.settings.twoFactor.resendIn(disableResendCooldown)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendDisableCode}
                  disabled={requestDisableTwoFactor.isPending}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  {t.settings.twoFactor.resend}
                </button>
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-secondary/50 border border-border">
            <div className="flex items-start gap-3">
              {user?.twoFactorEnabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <ShieldOff className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium text-foreground text-sm">
                  {user?.twoFactorEnabled
                    ? t.settings.twoFactor.enabled
                    : t.settings.twoFactor.disabled}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user?.twoFactorEnabled
                    ? t.settings.twoFactor.enabledDesc
                    : t.settings.twoFactor.disabledDesc}
                </p>
                {requestDisableTwoFactor.error && (
                  <p className="text-xs text-destructive mt-1">
                    {getErrorMessage(requestDisableTwoFactor.error)}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleToggleTwoFactor}
              disabled={setTwoFactor.isPending || requestDisableTwoFactor.isPending}
              className={[
                'relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none',
                user?.twoFactorEnabled ? 'bg-emerald-500' : 'bg-border',
                setTwoFactor.isPending || requestDisableTwoFactor.isPending
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer',
              ].join(' ')}
              role="switch"
              aria-checked={user?.twoFactorEnabled}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                  user?.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
        )}
      </div>

      {/* Password card */}
      <div className="card p-4 sm:p-7">
        <div className="flex items-center gap-2.5 mb-5 sm:mb-6">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-4.5 w-4.5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t.settings.password.title}</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-5">
          <Input
            label={t.settings.password.current}
            type="password"
            className="text-base"
            {...passwordForm.register('currentPassword', { required: t.validation.required })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t.settings.password.new}
              type="password"
              className="text-base"
              {...passwordForm.register('newPassword', {
                required: t.validation.required,
                minLength: { value: 8, message: t.validation.passwordMin8 },
              })}
            />
            <Input
              label={t.settings.password.confirm}
              type="password"
              className="text-base"
              {...passwordForm.register('confirmPassword', { required: t.validation.required })}
            />
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          {passwordSuccess && <SuccessBanner message={t.settings.password.success} />}
          <div className="flex justify-end pt-1">
            <Button type="submit" size="lg" isLoading={passwordForm.formState.isSubmitting}>
              <Save className="h-4 w-4 mr-2" /> {t.settings.password.update}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
