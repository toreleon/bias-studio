export type ImportTaskOptions = {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
};

function cancelled() {
  const error = new Error("Import cancelled. Your existing workspace is unchanged.");
  error.name = "AbortError";
  return error;
}

export function assertImportActive({ signal }: ImportTaskOptions) {
  if (signal?.aborted) throw cancelled();
}

/** A missing deadline lets the system picker remain open while a user chooses.
 * Cancelling stops waiting; native work may finish later but cannot resolve this task.
 */
export function waitForImport<T>(
  promise: Promise<T>,
  options: ImportTaskOptions = {},
  timeoutMs?: number,
  timeoutMessage = "Import took too long. Your existing work is safe. Try fewer photos or choose a photo saved on this device.",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => finish(() => reject(cancelled()));
    // Attach both handlers even for an already-aborted signal: a late native
    // rejection must be consumed rather than becoming an unhandled rejection.
    promise.then(
      (value) => options.signal?.aborted ? abort() : finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
    if (options.signal?.aborted) {
      abort();
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    if (timeoutMs !== undefined) {
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        finish(() => reject(new Error("Import deadline must be a non-negative duration.")));
        return;
      }
      timer = setTimeout(() => finish(() => {
        const error = new Error(timeoutMessage);
        error.name = "ImportTimeoutError";
        reject(error);
      }), timeoutMs);
    }
  });
}
