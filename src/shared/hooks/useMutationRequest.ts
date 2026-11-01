import { isCancel } from "axios";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { getAccessTokenVersion } from "@/shared/api/token.ts";

type PendingMutation = {
  controller: AbortController;
  version: number;
};

class MutationRequestError extends Error {
  readonly isCurrent: () => boolean;

  constructor(error: unknown, isCurrent: () => boolean) {
    super(error instanceof Error ? error.message : "Mutation failed", {
      cause: error,
    });
    this.name = "MutationRequestError";
    this.isCurrent = isCurrent;
  }
}

export const isCurrentMutationError = (
  error: unknown,
): error is MutationRequestError =>
  error instanceof MutationRequestError && error.isCurrent();

export const useMutationRequest = (identity: unknown, enabled = true) => {
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(false);
  const pending = useRef<PendingMutation | undefined>(undefined);
  const sequence = useRef(0);
  const version = getAccessTokenVersion();
  const scope = useMemo(
    () => ({ enabled, identity, version }),
    [enabled, identity, version],
  );
  const committed = useRef<typeof scope | undefined>(undefined);

  const cancel = useCallback(() => {
    sequence.current += 1;
    pending.current?.controller.abort();
    pending.current = undefined;
    if (mounted.current) setSubmitting(false);
  }, []);

  const run = useCallback(
    async <T>(
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<{ data: T; isCurrent: () => boolean } | undefined> => {
      if (
        !mounted.current ||
        !enabled ||
        committed.current !== scope ||
        version !== getAccessTokenVersion() ||
        pending.current
      )
        return;

      const request = { controller: new AbortController(), version };
      const current = ++sequence.current;
      pending.current = request;
      setSubmitting(true);
      const isCurrent = () =>
        mounted.current &&
        sequence.current === current &&
        !request.controller.signal.aborted &&
        committed.current === scope &&
        getAccessTokenVersion() === request.version;
      try {
        const data = await operation(request.controller.signal);
        if (isCurrent()) return { data, isCurrent };
      } catch (error) {
        if (isCurrent() && !isCancel(error))
          throw new MutationRequestError(error, isCurrent);
      } finally {
        if (pending.current === request) {
          pending.current = undefined;
          if (mounted.current) setSubmitting(false);
        }
      }
    },
    [enabled, scope, version],
  );

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);

  useLayoutEffect(() => {
    committed.current = scope;
    return () => {
      committed.current = undefined;
      cancel();
    };
  }, [cancel, scope]);

  return { cancel, run, submitting };
};
