import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

declare global {
  interface WindowEventMap {
    "local-storage": CustomEvent;
  }
}

type UseLocalStorageOptions<T> = {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  initializeWithValue?: boolean;
};

const IS_SERVER = typeof window === "undefined";

const useLocalStorage = <T>(
  key: string,
  initialValue: T | (() => T),
  options: UseLocalStorageOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>, () => void] => {
  const serializer = options.serializer;
  const customDeserializer = options.deserializer;
  const initializeWithValue = options.initializeWithValue ?? true;
  // Memoize the initial value once; safe because callers shouldn't change it after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialValueMemo = useMemo(() => initialValue, []);

  const getInitialValue = useCallback(() => {
    return initialValueMemo instanceof Function ? initialValueMemo() : initialValueMemo;
  }, [initialValueMemo]);

  const deserializer = useCallback<(value: string) => T>(
    (value) => {
      if (customDeserializer) {
        return customDeserializer(value);
      }

      // Support 'undefined' as a value
      if (value === "undefined") {
        return undefined as unknown as T;
      }

      const defaultValue = getInitialValue();

      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch (error) {
        console.error("Error parsing JSON:", error);
        return defaultValue;
      }

      return parsed as T;
    },
    [customDeserializer, getInitialValue]
  );

  const readValue = useCallback((): T => {
    const initialValueToUse = getInitialValue();

    if (IS_SERVER) {
      return initialValueToUse;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) {
        return initialValueToUse;
      }

      // Validate that the raw value is a string and not empty
      if (typeof raw !== "string" || raw.trim() === "") {
        console.warn(
          `Invalid localStorage value for key "${key}": expected string, got ${typeof raw}`
        );
        return initialValueToUse;
      }

      return deserializer(raw);
    } catch (error) {
      // More specific error handling
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.error(
          `localStorage quota exceeded for key "${key}". Clearing storage.`
        );
        try {
          window.localStorage.removeItem(key);
        } catch (clearError) {
          console.error(
            `Failed to clear localStorage key "${key}":`,
            clearError
          );
        }
      } else if (
        error instanceof DOMException &&
        error.name === "SecurityError"
      ) {
        console.error(
          `localStorage access denied for key "${key}" (private browsing mode?)`
        );
      } else {
        console.warn(`Error reading localStorage key "${key}":`, error);
      }
      return initialValueToUse;
    }
  }, [key, deserializer, getInitialValue]);

  const [storedValue, setStoredValue] = useState<T>(() => {
    return initializeWithValue
      ? readValue()
      : initialValue instanceof Function
        ? initialValue()
        : initialValue;
  });

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      if (IS_SERVER) {
        console.warn(
          `Tried setting localStorage key "${key}" even though environment is not a client`
        );
        return;
      }

      try {
        setStoredValue((currentValue) => {
          const newValue = value instanceof Function ? value(currentValue) : value;

          let currentSerialized: string;
          let newSerialized: string;

          try {
            currentSerialized = serializer
              ? serializer(currentValue)
              : JSON.stringify(currentValue);
            newSerialized = serializer
              ? serializer(newValue)
              : JSON.stringify(newValue);
          } catch (serializationError) {
            console.error(
              `Error serializing value for localStorage key "${key}":`,
              serializationError
            );
            return currentValue;
          }

          if (currentSerialized === newSerialized) {
            return currentValue;
          }

          const estimatedSize = new Blob([newSerialized]).size;
          if (estimatedSize > 4 * 1024 * 1024) {
            console.warn(
              `Large localStorage value detected (${Math.round(estimatedSize / 1024)}KB) for key "${key}". This may cause storage issues.`
            );
          }

          try {
            window.localStorage.setItem(key, newSerialized);
          } catch (storageError) {
            if (
              storageError instanceof DOMException &&
              storageError.name === "QuotaExceededError"
            ) {
              console.error(
                `localStorage quota exceeded when setting key "${key}". Attempting cleanup...`
              );

              try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                  const existingKey = window.localStorage.key(i);
                  if (
                    (existingKey && existingKey.startsWith("temp:")) ||
                    existingKey?.startsWith("cache:")
                  ) {
                    keysToRemove.push(existingKey);
                  }
                }
                keysToRemove.forEach((k) => {
                  window.localStorage.removeItem(k);
                });

                window.localStorage.setItem(key, newSerialized);
              } catch (retryError) {
                console.error(
                  `Failed to set localStorage after cleanup for key "${key}":`,
                  retryError
                );
                return currentValue;
              }
            } else {
              console.error(
                `Error setting localStorage key "${key}":`,
                storageError
              );
              return currentValue;
            }
          }

          try {
            window.dispatchEvent(
              new StorageEvent("storage", {
                key,
                newValue: newSerialized,
              })
            );

            window.dispatchEvent(
              new CustomEvent("local-storage", { detail: { key } })
            );
          } catch (eventError) {
            console.warn(
              `Error dispatching storage events for key "${key}":`,
              eventError
            );
          }

          return newValue;
        });
      } catch (error) {
        console.error(
          `Unexpected error setting localStorage key "${key}":`,
          error
        );
      }
    },
    [key, serializer]
  );

  const removeValue = useCallback(() => {
    if (IS_SERVER) {
      console.warn(
        `Tried removing localStorage key "${key}" even though environment is not a client`
      );
      return;
    }

    const defaultValue =
      initialValue instanceof Function ? initialValue() : initialValue;

    try {
      window.localStorage.removeItem(key);
      setStoredValue(defaultValue);

      try {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: null,
          })
        );

        window.dispatchEvent(
          new CustomEvent("local-storage", { detail: { key } })
        );
      } catch (eventError) {
        // Non-critical error - value was removed successfully
        console.warn(
          `Error dispatching storage events for key "${key}":`,
          eventError
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "SecurityError") {
        console.error(
          `localStorage access denied when removing key "${key}" (private browsing mode?)`
        );
      } else {
        console.error(`Error removing localStorage key "${key}":`, error);
      }
    }
  }, [initialValue, key]);

  useEffect(() => {
    if (IS_SERVER) {
      return;
    }

    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      try {
        const eventKey =
          e instanceof StorageEvent
            ? e.key
            : (e as CustomEvent<{ key: string }>).detail.key;

        if (eventKey === key) {
          const newValue = readValue();
          setStoredValue(newValue);
        }
      } catch (error) {
        console.warn(
          `Error handling storage change event for key "${key}":`,
          error
        );
      }
    };

    try {
      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("local-storage", handleStorageChange);
    } catch (error) {
      console.warn(
        `Error adding storage event listeners for key "${key}":`,
        error
      );
    }

    return () => {
      try {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("local-storage", handleStorageChange);
      } catch (error) {
        console.warn(
          `Error removing storage event listeners for key "${key}":`,
          error
        );
      }
    };
  }, [key, readValue]);

  return [storedValue, setValue, removeValue];
};

export { useLocalStorage };
