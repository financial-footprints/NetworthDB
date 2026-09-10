export const APP_ENVS = ["local", "production"] as const;

export type AppEnv = (typeof APP_ENVS)[number];

export const AUTH_ACR_AAL1 = "aal1";
export const AUTH_ACR_AAL2 = "aal2";
export const AUTH_AMR_PASSWORD = "pwd";
export const AUTH_AMR_OTP = "otp";
export const AUTH_AMR_RECOVERY = "rcc";
export const AUTH_AMR_WEBAUTHN = "hwk";
