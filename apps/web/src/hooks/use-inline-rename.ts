"use client";

import { type ChangeEvent, type FocusEvent, type KeyboardEvent, useState } from "react";

/** Draft state and input wiring for renaming in place: Enter or blur saves, Escape cancels. */
const useInlineRename = (name: string, rename: (next: string) => void) => {
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    if (draft === null) {
      return;
    }

    const next = draft.trim();
    setDraft(null);

    if (next !== "" && next !== name) {
      rename(next);
    }
  };

  return {
    handleStart: () => {
      setDraft(name);
    },
    inputProps:
      draft === null
        ? null
        : {
            onBlur: save,
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              setDraft(event.target.value);
            },
            onFocus: (event: FocusEvent<HTMLInputElement>) => {
              event.currentTarget.select();
            },
            onKeyDown: (event: KeyboardEvent) => {
              if (event.nativeEvent.isComposing) {
                return;
              }

              if (event.key === "Enter") {
                save();
              } else if (event.key === "Escape") {
                setDraft(null);
              }
            },
            value: draft,
          },
  };
};

export { useInlineRename };
