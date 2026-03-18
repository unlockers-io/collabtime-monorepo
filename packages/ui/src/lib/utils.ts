import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Array<ClassValue>) => {
  return twMerge(clsx(inputs));
};

export { cn };
