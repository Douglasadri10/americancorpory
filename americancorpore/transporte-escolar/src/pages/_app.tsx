import "@/styles/globals.css";
import type { AppProps } from "next/app";
import * as AuthContext from "@/contexts/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthContext.AuthProvider>
      <Component {...pageProps} />
    </AuthContext.AuthProvider>
  );
}
