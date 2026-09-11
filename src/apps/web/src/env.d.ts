/// <reference types="@rsbuild/core/types" />

declare module "*.svg" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly PUBLIC_API_ORIGIN?: string;
}
