type ActionResult<T> =
  | {
      data: T;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

export type { ActionResult };
