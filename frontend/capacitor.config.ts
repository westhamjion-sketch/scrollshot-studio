import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.westhamjion.scrollshot",
  appName: "卷轴",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1114",
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0b1114",
      showSpinner: false,
    },
  },
};

export default config;
