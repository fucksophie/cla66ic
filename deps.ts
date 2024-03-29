import "https://deno.land/x/dotenv@v3.2.0/load.ts";

import { ApiFactory } from "https://deno.land/x/aws_api@v0.7.0/client/mod.ts";
import { S3 } from "https://aws-api.deno.dev/v0.3/services/s3.ts";

export * as log from "https://deno.land/std@0.136.0/log/mod.ts";
export { crypto } from "https://deno.land/std@0.136.0/crypto/mod.ts";
export { EventEmitter } from "./events.ts";
import "https://deno.land/x/dotenv@v3.2.0/load.ts";
export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

export const s3 = new ApiFactory({
  credentials: {
    awsAccessKeyId: Deno.env.get("S3_ACCESS_KEY_ID")!,
    awsSecretKey: Deno.env.get("S3_SECRET_KEY")!,
  },
  fixedEndpoint: Deno.env.get("S3_ENDPOINT_URL"),
  region: "us-west-004",
}).makeNew(S3);

export const config = {
  ops: Deno.env.get("OPS") ? JSON.parse(Deno.env.get("OPS")!) : [],
  port: +Deno.env.get("PORT")!,
  hash: Deno.env.get("HASH"),
  onlineMode: Deno.env.get("ONLINEMODE") == "true",
  main: Deno.env.get("MAIN") || "main",
  maxUsers: +(Deno.env.get("USERS") || 24) > 255 ? 255 : +(Deno.env.get("USERS") || 24),
  software: Deno.env.get("SOFTWARE") || "Custom Cla66ic",
  name: Deno.env.get("NAME") || "Cla66ic Server"
};
