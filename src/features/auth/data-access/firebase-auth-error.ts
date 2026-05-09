import { TranslocoService } from '@jsverse/transloco';

const KEY_BY_CODE: Record<string, string> = {
  'auth/popup-closed-by-user': 'auth.message.errorPopupClosed',
  'auth/cancelled-popup-request': 'auth.message.errorPopupClosed',
  'auth/user-cancelled': 'auth.message.errorPopupClosed',
  'auth/popup-blocked': 'auth.message.errorPopupBlocked',
  'auth/network-request-failed': 'auth.message.errorNetworkFailed',
  'auth/unauthorized-domain': 'auth.message.errorUnauthorizedDomain',
  'auth/account-exists-with-different-credential': 'auth.message.errorAccountExists',
  'auth/too-many-requests': 'auth.message.errorTooManyRequests',
};

function firebaseCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return undefined;
}

export function translateFirebaseAuthError(err: unknown, transloco: TranslocoService): string {
  const code = firebaseCode(err);
  if (code) {
    const mapped = KEY_BY_CODE[code];
    if (mapped) return transloco.translate(mapped);
    return transloco.translate('auth.message.errorGeneric', { code });
  }
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
