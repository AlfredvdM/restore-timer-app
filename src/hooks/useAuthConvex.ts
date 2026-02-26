import { useQuery, useMutation } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";

const TOKEN = import.meta.env.VITE_PRACTICE_TOKEN as string;

/**
 * Drop-in wrapper for useQuery that auto-injects the auth token.
 * Pass `"skip"` as args to skip the query (same as convex/react).
 */
export function useAuthQuery<F extends FunctionReference<"query">>(
  func: F,
  args: Omit<FunctionArgs<F>, "token"> | "skip",
): FunctionReturnType<F> | undefined {
  return useQuery(
    func,
    args === "skip" ? "skip" : ({ ...args, token: TOKEN } as any),
  );
}

/**
 * Drop-in wrapper for useMutation that auto-injects the auth token.
 * Returns a function that accepts the original args (minus `token`).
 */
export function useAuthMutation<F extends FunctionReference<"mutation">>(
  func: F,
): (args: Omit<FunctionArgs<F>, "token">) => Promise<FunctionReturnType<F>> {
  const mutate = useMutation(func);
  return (args: Omit<FunctionArgs<F>, "token">) =>
    mutate({ ...args, token: TOKEN } as any);
}
