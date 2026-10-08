import { getCarSkin } from './car-skins.js';

export const SKIN_COOKIE = 'togai_skin';

export function createSkinPreference(document, location) {
  const path = new URL('.', location.href).pathname;
  let skin = getCarSkin();
  let saved = true;
  try {
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SKIN_COOKIE}=`));
    skin = getCarSkin(cookie?.slice(SKIN_COOKIE.length + 1));
  } catch {
    saved = false;
  }
  return {
    get skin() {
      return skin;
    },
    get saved() {
      return saved;
    },
    select(id) {
      skin = getCarSkin(id);
      try {
        document.cookie = `${SKIN_COOKIE}=${skin.id}; Max-Age=31536000; Path=${path}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        saved = document.cookie
          .split(';')
          .some((part) => part.trim() === `${SKIN_COOKIE}=${skin.id}`);
      } catch {
        saved = false;
      }
    },
  };
}
