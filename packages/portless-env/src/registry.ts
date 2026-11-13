const apps = {
  web: { name: "collabtime.web", port: 3000 },
} as const;

const urlEnv = {
  CORS_ORIGINS: ["web"],
  WEB_APP_URL: ["web"],
} as const satisfies Record<string, ReadonlyArray<keyof typeof apps>>;

export { apps, urlEnv };
