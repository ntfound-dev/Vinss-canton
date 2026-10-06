// Bound UI waiting without pretending to cancel the wallet's own request.
export function walletWait<T>(pending: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "The wallet has not responded yet. Complete or cancel the request in its window, then try again.",
          ),
        ),
      ms,
    );
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
