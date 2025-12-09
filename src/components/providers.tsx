"use client";

import { RealtimeProvider } from "@upstash/realtime/client";

type ProvidersProps = {
  children: React.ReactNode;
};

const Providers = ({ children }: ProvidersProps) => {
  return (
    <RealtimeProvider api={{ url: "/api/realtime" }}>
      {children}
    </RealtimeProvider>
  );
};

export { Providers };
