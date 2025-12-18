import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, "0")}:00`;
};

export { cn, formatHour };
