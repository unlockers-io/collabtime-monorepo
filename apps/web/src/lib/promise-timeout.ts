class TimeoutError extends Error {
  constructor() {
    super("Operation timed out");
    this.name = "TimeoutError";
  }
}

const withTimeout = async <T>(
  operation: Promise<T>,
  milliseconds: number,
  signal?: AbortSignal,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener: (() => void) | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        const abort = () => {
          reject(new DOMException("Operation aborted", "AbortError"));
        };

        signal?.addEventListener("abort", abort, { once: true });
        removeAbortListener = () => {
          signal?.removeEventListener("abort", abort);
        };

        if (signal?.aborted === true) {
          abort();
        }

        timer = setTimeout(() => {
          reject(new TimeoutError());
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    removeAbortListener?.();
  }
};

export { TimeoutError, withTimeout };
