const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "supabase", "migrations");
const outDir = path.join(__dirname, "..", "supabase");
const pid =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ||
  "";
if (!pid) {
  console.error(
    "Missing project id: set SUPABASE_PROJECT_REF or EXPO_PUBLIC_SUPABASE_URL (…ref.supabase.co).",
  );
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter(
    (f) =>
      f.startsWith("202604191300") &&
      f.endsWith(".sql") &&
      f !== "20260419130000_baseline_updated_at_fn.sql",
  )
  .sort();

let i = 1;
for (const f of files) {
  const stem = path.basename(f, ".sql");
  const name = stem.replace(/^\d+_/, "");
  const q = fs.readFileSync(path.join(dir, f), "utf8");
  const body = { project_id: pid, name, query: q };
  fs.writeFileSync(path.join(outDir, `mcp_apply_seq_${i++}.json`), JSON.stringify(body));
}

console.log("wrote", i - 1, "files");
