type ActionResult<T> =
  | {
      data: T;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

type ActionErrorEvent = {
  error?: unknown;
  message: string;
  reason?: string;
  requestId?: string;
  route: string;
  teamId?: string;
};

export type { ActionErrorEvent, ActionResult };
