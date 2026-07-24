#!/usr/bin/env node
// Pulls the most recently pushed public repos for GITHUB_USER via the GitHub API
// and rewrites the auto-generated section of README.md between the marker comments.

const fs = require("fs");
const path = require("path");

const GITHUB_USER = process.env.GITHUB_USER || "sevasek";
const README_PATH = path.join(__dirname, "..", "README.md");
const START_MARKER = "<!-- RECENT-REPOS:START -->";
const END_MARKER = "<!-- RECENT-REPOS:END -->";
const MAX_REPOS = 5;
// Repos already curated by hand in "Selected Work" are excluded so the feed
// only surfaces things not already featured there.
const EXCLUDE_REPOS = new Set([GITHUB_USER, "smx", "babud", "aem", "orgcontext", "llmwallet"]);

async function fetchRecentRepos() {
  const url = `https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&direction=desc&per_page=30`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `${GITHUB_USER}-profile-readme-bot`,
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
  }

  const repos = await res.json();

  return repos
    .filter((repo) => !repo.fork && !repo.archived && !repo.private)
    .filter((repo) => !EXCLUDE_REPOS.has(repo.name.toLowerCase()))
    .slice(0, MAX_REPOS);
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderSection(repos) {
  if (repos.length === 0) {
    return `${START_MARKER}\n_No recent activity to show right now._\n${END_MARKER}`;
  }

  const lines = repos.map((repo) => {
    const description = repo.description ? repo.description : "_No description yet._";
    return `- **[${repo.name}](${repo.html_url})** — ${description} <sub>(updated ${formatDate(repo.pushed_at)})</sub>`;
  });

  return `${START_MARKER}\n${lines.join("\n")}\n${END_MARKER}`;
}

async function main() {
  const repos = await fetchRecentRepos();
  const section = renderSection(repos);

  const readme = fs.readFileSync(README_PATH, "utf8");
  const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);

  if (!pattern.test(readme)) {
    throw new Error(`Could not find ${START_MARKER} / ${END_MARKER} markers in README.md`);
  }

  const updated = readme.replace(pattern, section);

  if (updated !== readme) {
    fs.writeFileSync(README_PATH, updated);
    console.log(`Updated README.md with ${repos.length} recently pushed repo(s).`);
  } else {
    console.log("README.md already up to date.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
