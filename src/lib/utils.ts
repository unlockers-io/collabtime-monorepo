const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, "0")}:00`;
};

const debounce = <T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

const cn = (...classes: Array<string | undefined | false | null>) =>
  classes.filter(Boolean).join(" ");

export { formatHour, debounce, cn };
