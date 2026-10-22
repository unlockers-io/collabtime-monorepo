const getClientIp = (request: Request): string => {
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return first === undefined || first === "" ? "unknown" : first;
};

export { getClientIp };
