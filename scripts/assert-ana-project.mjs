import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const EXPECTED = {
  directory: "nuevo-proyecto-ia",
  repository: "anapaullerenas/nuevo-proyecto-ia",
  remote: "git@github-ana:anapaullerenas/nuevo-proyecto-ia.git",
  projectId: "prj_djSrAgLAoFgYPOIvwvFc8vKxkndB",
  orgId: "team_e8Qmin1h2SiXcNaAnlyl8Ei0",
  projectName: "nuevo-proyecto-ia",
  supabaseRef: "rjjrwthkyeuxzecomkga",
};

const production = process.argv.includes("--production");
const fail = (message) => {
  console.error(`\nDEPLOYMENT BLOCKED\n${message}\n`);
  process.exit(1);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

if (process.env.GITHUB_ACTIONS === "true") {
  if (process.env.GITHUB_REPOSITORY !== EXPECTED.repository) {
    fail(`This workflow only belongs to ${EXPECTED.repository}. Received: ${process.env.GITHUB_REPOSITORY || "unknown"}.`);
  }
  console.log(`Ownership verified: ${EXPECTED.repository}`);
  process.exit(0);
}

if (basename(resolve(process.cwd())) !== EXPECTED.directory) {
  fail(`Run this command only from the Ana platform workspace: ${EXPECTED.directory}.`);
}

const remote = git("remote", "get-url", "origin");
if (remote !== EXPECTED.remote) {
  fail(`Unexpected GitHub remote: ${remote}. Expected ${EXPECTED.remote}.`);
}

let linked;
try {
  linked = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
} catch {
  fail("This directory is not linked to Ana's Vercel project.");
}

for (const key of ["projectId", "orgId", "projectName"]) {
  if (linked[key] !== EXPECTED[key]) fail(`Vercel ${key} mismatch. Deployment cancelled.`);
}

const env = readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
if (!supabaseUrl || !supabaseUrl.includes(`${EXPECTED.supabaseRef}.supabase.co`)) {
  fail(`Supabase project mismatch. Expected project ref ${EXPECTED.supabaseRef}.`);
}

if (production) {
  const branch = git("branch", "--show-current");
  if (branch !== "main") fail(`Production deploys are allowed only from main. Current branch: ${branch || "detached"}.`);
  if (git("status", "--porcelain")) fail("Production deploys require a clean working tree committed to GitHub.");
}

console.log(`Ana project verified: ${EXPECTED.repository} → ${EXPECTED.projectName} → ${EXPECTED.supabaseRef}`);
