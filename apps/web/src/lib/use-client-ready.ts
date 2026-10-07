"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientReady = () => true;
const getServerReady = () => false;

// Client-only controls must wait for their handlers before accepting input.
const useClientReady = (): boolean =>
  useSyncExternalStore(subscribe, getClientReady, getServerReady);

export { useClientReady };
