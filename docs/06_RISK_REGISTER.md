# Quiksheets — Risk Register

| Risk | Severity | Control |
|---|---:|---|
| Spreadsheet engine lock-in | High | Use SpreadsheetEngineAdapter; Univer primary, FortuneSheet fallback |
| Formula engine mismatch | High | Use FormulaEngineAdapter; do not duplicate formula state |
| HyperFormula licensing | High | Optional fallback only; license checkpoint before production |
| Realtime conflict issues | High | Broadcast/Presence for lightweight events; Yjs or Univer Pro for concurrent editing |
| Groq model deprecation | High | Centralize model config; use llama-3.3-70b-versatile |
| API key exposure | High | Server-side Groq only; no client API keys |
| RLS gaps | High | RLS from backend session; add policy tests |
| P2 scope creep | High | Feature flags; P0/P1 first |
| Import/export fidelity | Medium | Define fidelity matrix and test XLSX/CSV edge cases |
| Large grid performance | High | Virtualization/engine-native rendering; avoid global cell state |
| AI hallucinated edits | Medium | Preview-before-apply; schema validation; undo/history |
| Codex context drift | Medium | AGENTS.md + docs + one-session prompts |
