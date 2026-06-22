import { cn } from "cnfast";

const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, "0")}:00`;
};

export { cn, formatHour };
