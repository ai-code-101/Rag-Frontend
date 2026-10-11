// Runtime configuration (read on the server at request time, so one image serves every
// environment). Never import this from client components.
import "server-only";

function trim(u: string) {
  return u.replace(/\/+$/, "");
}

export const serverEnv = {
  apiInternalUrl: trim(process.env.API_INTERNAL_URL ?? "http://localhost:8080"),
  publicApiUrl: trim(process.env.PUBLIC_API_URL ?? "http://localhost:8080"),
  publicWebUrl: trim(process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"),
};
