#!/usr/bin/env node
/**
 * BeforeTool hook — Secret Scanner
 * Blocks file writes containing API keys, passwords, tokens, or credentials.
 * Cross-platform (Node.js).
 */

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const content =
    input.tool_input?.content ||
    input.tool_input?.new_string ||
    input.tool_input?.text ||
    "";
  const file = input.tool_input?.path || input.tool_input?.file_path || "unknown";

  if (!content) {
    console.log("{}");
    process.exit(0);
  }

  const patterns = [
    // AWS
    { regex: /AKIA[0-9A-Z]{16}/, name: "AWS Access Key" },
    { regex: /aws_secret_access_key\s*=/i, name: "AWS Secret Key assignment" },
    // GitHub
    { regex: /ghp_[a-zA-Z0-9]{36}/, name: "GitHub Personal Access Token" },
    { regex: /github_pat_[a-zA-Z0-9_]{22,}/, name: "GitHub Fine-Grained Token" },
    // OpenAI / Generic API keys
    { regex: /sk-[a-zA-Z0-9]{20,}/, name: "API Secret Key" },
    // Bearer tokens (hardcoded)
    { regex: /Bearer\s+[a-zA-Z0-9_\-.]{40,}/, name: "Hardcoded Bearer Token" },
    // Passwords in assignments
    { regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/i, name: "Password assignment" },
    { regex: /(?:secret|api_key|apikey)\s*[:=]\s*["'][^"']{4,}["']/i, name: "Secret/API key assignment" },
    // Private keys
    { regex: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----/, name: "Private Key" },
    // Connection strings with embedded credentials
    { regex: /:\/\/[^:\s]+:[^@\s]+@[^/\s]+/, name: "Connection string with credentials" },
    // Azure / GCP
    { regex: /AccountKey=[a-zA-Z0-9+/=]{40,}/, name: "Azure Storage Account Key" },
    { regex: /AIza[0-9A-Za-z_-]{35}/, name: "Google API Key" },
  ];

  for (const { regex, name } of patterns) {
    if (regex.test(content)) {
      const match = content.match(regex)?.[0]?.slice(0, 30) || "";
      const reason = `Blocked: ${name} detected in ${file} (matched: "${match}..."). Use environment variables or a secrets manager instead.`;
      console.log(JSON.stringify({ decision: "deny", reason }));
      process.stderr.write(`SECRET SCANNER: Blocked write to ${file} — ${name}\n`);
      process.exit(0);
    }
  }

  // Safe — allow write
  console.log("{}");
  process.exit(0);
});
