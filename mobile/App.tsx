import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, BackHandler, Linking, Platform, StyleSheet, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GAME_HTML } from './src/gameHtml';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

/** Fixed origin for the inlined game, so localStorage (the save game) persists between launches. */
const BASE_URL = 'https://windsculptor.local/';
const BACKGROUND = '#ffe6c7';

type GameMessage = { type: 'ready' } | { type: 'exit' } | { type: 'haptic'; kind: 'tap' | 'gust' | 'shape' | 'success' | 'failure' };

function playHaptic(kind: string): void {
  switch (kind) {
    case 'tap':
      void Haptics.selectionAsync();
      break;
    case 'gust':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'shape':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'success':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'failure':
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
  }
}

function Game() {
  const webView = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const splashHidden = useRef(false);

  const hideSplash = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.hide();
  }, []);

  // The game reads these (with env(safe-area-inset-*)) once at start-up to keep its HUD clear of notches.
  const injectedBeforeLoad = useMemo(
    () => `(function () {
      var s = document.documentElement.style;
      s.setProperty('--native-safe-top', '${insets.top}px');
      s.setProperty('--native-safe-bottom', '${insets.bottom}px');
    })(); true;`,
    // Only the values at first load matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Pause the simulation and audio while the app is in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      webView.current?.injectJavaScript(`window.__wsNative && window.__wsNative.setActive(${active}); true;`);
    });
    return () => sub.remove();
  }, []);

  // Android back button: go back inside the game; close the app from the main menu.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      webView.current?.injectJavaScript(
        `if (!(window.__wsNative && window.__wsNative.back())) window.ReactNativeWebView.postMessage('{"type":"exit"}'); true;`,
      );
      return true;
    });
    return () => sub.remove();
  }, []);

  // Fallback in case the game never reports "ready".
  useEffect(() => {
    const timer = setTimeout(hideSplash, 6000);
    return () => clearTimeout(timer);
  }, [hideSplash]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let message: GameMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as GameMessage;
      } catch {
        return;
      }
      if (message.type === 'haptic') playHaptic(message.kind);
      else if (message.type === 'ready') setTimeout(hideSplash, 250);
      else if (message.type === 'exit') BackHandler.exitApp();
    },
    [hideSplash],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <WebView
        ref={webView}
        style={styles.web}
        source={{ html: GAME_HTML, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeLoad}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith(BASE_URL) || request.url.startsWith('about:') || request.url.startsWith('data:')) return true;
          // The game has no external links; open anything unexpected in the system browser.
          if (/^https?:/.test(request.url)) void Linking.openURL(request.url);
          return false;
        }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        setSupportMultipleWindows={false}
        textZoom={100}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction
        webviewDebuggingEnabled={__DEV__}
        // Recover if the OS kills the web content process (low memory).
        onContentProcessDidTerminate={() => webView.current?.reload()}
        onRenderProcessGone={() => webView.current?.reload()}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Game />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  web: { flex: 1, backgroundColor: BACKGROUND },
});
