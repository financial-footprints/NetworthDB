export function apiPath(template: string, params?: Record<string, string>): string {
  let path = template;
  for (const [key, value] of Object.entries(params ?? {})) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  return path;
}
