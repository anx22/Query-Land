#!/usr/bin/env node

const TARGET_SETTINGS = Object.freeze({
  rootDirectory: "apps/web",
  framework: "nextjs",
  buildCommand: "npm run vercel-build",
  outputDirectory: ".next",
  sourceFilesOutsideRootDirectory: true
});

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readOption = (name) => {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
};

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`Sync Vercel project settings for the SEO Tool web deployment.\n\nUsage:\n  npm run vercel:sync-settings -- --project <project-id-or-name> [--team <team-id-or-slug>] [--dry-run]\n\nEnvironment alternatives:\n  VERCEL_TOKEN             Required unless --dry-run is used\n  VERCEL_PROJECT_ID        Project id/name fallback\n  VERCEL_PROJECT_NAME      Project id/name fallback\n  VERCEL_TEAM_ID           Optional team id\n  VERCEL_TEAM_SLUG         Optional team slug\n\nSettings applied:\n${JSON.stringify(TARGET_SETTINGS, null, 2)}\n`);
  process.exit(0);
}

const dryRun = hasFlag("--dry-run");
const token = process.env.VERCEL_TOKEN;
const project = readOption("--project") ?? process.env.VERCEL_PROJECT_ID ?? process.env.VERCEL_PROJECT_NAME;
const team = readOption("--team") ?? process.env.VERCEL_TEAM_ID ?? process.env.VERCEL_TEAM_SLUG;

if (!project) {
  throw new Error("Missing Vercel project. Pass --project or set VERCEL_PROJECT_ID / VERCEL_PROJECT_NAME.");
}

const query = new URLSearchParams();
if (team) {
  if (team.startsWith("team_")) {
    query.set("teamId", team);
  } else {
    query.set("slug", team);
  }
}

const endpoint = new URL(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}`);
endpoint.search = query.toString();

if (dryRun) {
  console.log("Dry run only. No Vercel API request was sent.");
  console.log(`PATCH ${endpoint.toString()}`);
  console.log(JSON.stringify(TARGET_SETTINGS, null, 2));
  process.exit(0);
}

if (!token) {
  throw new Error("Missing VERCEL_TOKEN. Create a Vercel token and export it before running this command.");
}

const response = await fetch(endpoint, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(TARGET_SETTINGS)
});

const responseText = await response.text();
let body;
if (responseText) {
  body = JSON.parse(responseText);
}

if (!response.ok) {
  const message = body?.error?.message ?? body?.message ?? responseText;
  throw new Error(`Vercel project settings update failed (${response.status}): ${message}`);
}

const applied = {
  id: body.id,
  name: body.name,
  rootDirectory: body.rootDirectory,
  framework: body.framework,
  buildCommand: body.buildCommand,
  outputDirectory: body.outputDirectory,
  sourceFilesOutsideRootDirectory: body.sourceFilesOutsideRootDirectory
};

console.log("Vercel project settings updated.");
console.log(JSON.stringify(applied, null, 2));
