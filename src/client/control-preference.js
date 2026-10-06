export const CONTROL_COOKIE = 'togai_controls';
const MAX_AGE = 60 * 60 * 24 * 365;

export function parseControlMode(value) {
  return value === 'joystick' ? 'joystick' : 'screen';
}

export function createControlPreference(document, location) {
  const path = new URL('.', location.href).pathname;
  let mode = 'screen';
  let saved = true;
  try {
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CONTROL_COOKIE}=`));
    mode = parseControlMode(cookie?.slice(CONTROL_COOKIE.length + 1));
  } catch {
    saved = false;
  }
  return {
    get mode() {
      return mode;
    },
    get saved() {
      return saved;
    },
    setMode(next) {
      mode = parseControlMode(next);
      try {
        document.cookie = `${CONTROL_COOKIE}=${mode}; Max-Age=${MAX_AGE}; Path=${path}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        saved = document.cookie
          .split(';')
          .some((part) => part.trim() === `${CONTROL_COOKIE}=${mode}`);
      } catch {
        saved = false;
      }
    },
  };
}
