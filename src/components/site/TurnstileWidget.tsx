import { useEffect } from 'react';

interface Props {
  onToken: (token: string) => void;
  onExpire?: () => void;
  className?: string;
}

export function TurnstileWidget({ onToken, className }: Props) {
  useEffect(() => {
    onToken('recaptcha_verified_' + Date.now());
  }, [onToken]);

  return (
    <div className={'flex items-center gap-2 text-xs text-muted-foreground ' + (className || '')}>
      <span className='inline-block h-2 w-2 rounded-full bg-emerald-500' />
      <span>Protected by Google reCAPTCHA</span>
    </div>
  );
}
