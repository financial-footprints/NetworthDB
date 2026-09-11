function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes("NetworkError");
}

export function errorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return "Could not reach the server.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
