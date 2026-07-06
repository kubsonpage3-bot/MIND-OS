export const isMobileApp = () => {
  if (typeof window === 'undefined') return false;

  // 1. Детекция Android TWA — самый надежный способ для Google Play
  const isTWA = document.referrer.includes('android-app://');

  // 2. Детекция WebView (Android и iOS)
  const ua = navigator.userAgent;
  const isAndroidWebView = /wv/.test(ua);
  // Эвристика для iOS WebView: есть AppleWebKit, но нет Safari
  const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua);

  // 3. Детекция установленного PWA ИМЕННО на мобильных устройствах
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isMobilePWA = isStandalone && isMobileDevice;

  return isTWA || isAndroidWebView || isIOSWebView || isMobilePWA;
}
