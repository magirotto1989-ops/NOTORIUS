import { router } from 'expo-router';

/** Volta se houver histórico; senão vai para um destino seguro (ex.: tela aberta por link direto). */
export function goBack(fallback: '/home' | '/earnings' | '/explore' | '/tracks' = '/home') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
