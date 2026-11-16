const MAX_VALUE_LENGTH = 2_000;
const MAX_CONTEXT_DEPTH = 10;
const MAX_CONTEXT_VALUES = 1_000;
const REDACTED = "[redacted]";

type ErrorContext = Record<string, unknown>;

type ObservabilityEvent =
  | {
      context?: ErrorContext;
      message: string;
      name: "error";
      release: string;
      stack?: string;
      timestamp: string;
    }
  | {
      metric: "long-task";
      name: "performance";
      release: string;
      timestamp: string;
      value: number;
    }
  | {
      delta: Metric["delta"];
      metric: Metric["name"];
      name: "performance";
      rating: Metric["rating"];
      release: string;
      timestamp: string;
      unit: "milliseconds" | "score";
      value: Metric["value"];
    };

type ObservabilityTransport = (
  event: ObservabilityEvent,
) => void | Promise<void>;

const release = import.meta.env.VITE_RELEASE_ID ?? "unknown";
const endpoint = import.meta.env.VITE_OBSERVABILITY_URL;

const isSensitiveKey = (key: string) =>
  /api[-_]?key|authorization|cookie|password|secret|token/i.test(key);

const sanitizeText = (value: string) =>
  value
    .replaceAll(
      /(?<![\w.+-])[\w+-]+(?:\.[\w+-]+)*@(?:[\w-]+\.)+[A-Za-z]{2,}(?![\w.-])/g,
      REDACTED,
    )
    .replaceAll(
      /((?:api[-_]?key|authorization|cookie|password|secret|token)=)[^&\s]+/gi,
      `$1${REDACTED}`,
    )
    .replaceAll(/([?&])[^?&=\s]+=[^&\s]*/g, `$1${REDACTED}`)
    .slice(0, MAX_VALUE_LENGTH);

export const sanitizeObservabilityValue = (value: unknown): unknown => {
  const ancestors = new WeakSet<object>();
  let remaining = MAX_CONTEXT_VALUES;
  const sanitizeProperty = (object: object, key: string, depth: number) => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return undefined;
    return "value" in descriptor ? sanitize(descriptor.value, depth) : REDACTED;
  };
  const sanitize = (nested: unknown, depth: number): unknown => {
    if (remaining-- <= 0) return REDACTED;
    switch (typeof nested) {
      case "string":
        return sanitizeText(nested);
      case "number":
        return Number.isFinite(nested) ? nested : REDACTED;
      case "undefined":
      case "function":
      case "symbol":
      case "bigint":
        return REDACTED;
    }
    if (!nested || typeof nested !== "object") return nested;
    if (depth >= MAX_CONTEXT_DEPTH || ancestors.has(nested)) return REDACTED;

    ancestors.add(nested);
    try {
      if (Array.isArray(nested)) {
        return Array.from(
          { length: Math.min(nested.length, remaining) },
          (_, index) => sanitizeProperty(nested, String(index), depth + 1),
        );
      }
      return Object.fromEntries(
        Object.keys(nested)
          .slice(0, remaining)
          .map((key) => [
            key,
            isSensitiveKey(key)
              ? REDACTED
              : sanitizeProperty(nested, key, depth + 1),
          ]),
      );
    } catch {
      return REDACTED;
    } finally {
      ancestors.delete(nested);
    }
  };
  return sanitize(value, 0);
};

const defaultTransport: ObservabilityTransport = async (event) => {
  if (!endpoint) {
    return;
  }

  try {
    await fetch(endpoint, {
      body: JSON.stringify(event),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // Observability must never disrupt the application.
  }
};

let transport = defaultTransport;
let initialized = false;
const lastVitals = new Map<
  Metric["name"],
  Pick<Metric, "id" | "rating" | "value">
>();
const vitalNames = new Set<Metric["name"]>([
  "CLS",
  "FCP",
  "INP",
  "LCP",
  "TTFB",
]);
const vitalRatings = new Set<Metric["rating"]>([
  "good",
  "needs-improvement",
  "poor",
]);

const deliverEvent = (event: ObservabilityEvent) => {
  try {
    void Promise.resolve(transport(event)).catch(() => {});
  } catch {
    // Optional reporting must not interrupt the application.
  }
};

export const setObservabilityTransport = (
  nextTransport?: ObservabilityTransport,
) => {
  transport = nextTransport ?? defaultTransport;
  lastVitals.clear();
};

export const reportError = (error: unknown, context?: ErrorContext): void => {
  try {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    const requestId =
      "requestId" in normalizedError &&
      typeof normalizedError.requestId === "string" &&
      /^[\w=-]{1,128}$/.test(normalizedError.requestId)
        ? normalizedError.requestId
        : undefined;
    const sanitizedContext = context
      ? sanitizeObservabilityValue(context)
      : undefined;
    const safeContext =
      sanitizedContext &&
      typeof sanitizedContext === "object" &&
      !Array.isArray(sanitizedContext)
        ? (sanitizedContext as ErrorContext)
        : undefined;
    const eventContext = requestId
      ? { ...safeContext, requestId }
      : safeContext;

    deliverEvent({
      context: eventContext,
      message: sanitizeText(normalizedError.message),
      name: "error",
      release,
      stack: normalizedError.stack
        ? sanitizeText(normalizedError.stack)
        : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Untrusted error/context inspection must not replace the original failure.
  }
};

const reportPerformance = (metric: "long-task", value: number) => {
  deliverEvent({
    metric,
    name: "performance",
    release,
    timestamp: new Date().toISOString(),
    value: Math.round(value * 100) / 100,
  });
};

const reportWebVital = (metric: Metric) => {
  if (
    !vitalNames.has(metric.name) ||
    !vitalRatings.has(metric.rating) ||
    !Number.isFinite(metric.value) ||
    metric.value < 0 ||
    !Number.isFinite(metric.delta)
  )
    return;
  const previous = lastVitals.get(metric.name);
  if (
    previous?.id === metric.id &&
    previous.value === metric.value &&
    previous.rating === metric.rating
  )
    return;
  lastVitals.set(metric.name, {
    id: metric.id,
    rating: metric.rating,
    value: metric.value,
  });
  deliverEvent(
    Object.freeze({
      delta: metric.delta,
      metric: metric.name,
      name: "performance",
      rating: metric.rating,
      release,
      timestamp: new Date().toISOString(),
      unit: metric.name === "CLS" ? "score" : "milliseconds",
      value: metric.value,
    }),
  );
};

export const initializeObservability = (): void => {
  if (initialized || typeof window === "undefined") {
    return;
  }
  initialized = true;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, {
      column: event.colno,
      filename: event.filename,
      line: event.lineno,
      source: "window.error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });

  if (typeof PerformanceObserver === "undefined") {
    return;
  }

  const supportedTypes = PerformanceObserver.supportedEntryTypes ?? [];
  onCLS(reportWebVital);
  onFCP(reportWebVital);
  onINP(reportWebVital);
  onLCP(reportWebVital);
  onTTFB(reportWebVital);

  if (supportedTypes.includes("longtask")) {
    new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        reportPerformance("long-task", entry.duration);
      });
    }).observe({ buffered: true, type: "longtask" });
  }
};
import type { Metric } from "web-vitals";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
