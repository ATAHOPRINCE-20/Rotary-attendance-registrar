import { useQuery } from "@tanstack/react-query";
import type { RotaryClub } from "../types/database";

// Fetch all rotary clubs sorted alphabetically (via Redis cached API endpoint)
export function useRotaryClubs() {
  return useQuery({
    queryKey: ["rotary_clubs"],
    queryFn: async () => {
      const res = await fetch("/api/clubs");
      if (!res.ok) {
        throw new Error("Failed to fetch rotary clubs from cache/API");
      }
      return res.json() as Promise<RotaryClub[]>;
    },
  });
}
