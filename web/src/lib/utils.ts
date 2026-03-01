import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// api base receives info from backend 
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000"; 