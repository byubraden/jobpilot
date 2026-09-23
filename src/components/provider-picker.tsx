"use client";

import type { ProviderSelectionKind } from "../lib/services/container";

type Props = {
  value: ProviderSelectionKind;
  onChange: (value: ProviderSelectionKind) => void;
  name?: string;
};

export function ProviderPicker({ value, onChange, name = "providerKind" }: Props) {
  return (
    <fieldset className="provider-picker">
      <legend>AI provider</legend>
      <div className="provider-options">
        <label className="provider-option">
          <input type="radio" name={name} value="ollama" checked={value === "ollama"} onChange={() => onChange("ollama")} />
          <span><strong>Ollama · local</strong><small>Runs locally with Ollama. Your profile and job description stay on this machine.</small></span>
        </label>
        <label className="provider-option">
          <input type="radio" name={name} value="anthropic" checked={value === "anthropic"} onChange={() => onChange("anthropic")} />
          <span><strong>Claude · Anthropic API</strong><small>Sending to Claude uses API credit.</small></span>
        </label>
        <label className="provider-option">
          <input type="radio" name={name} value="mock" checked={value === "mock"} onChange={() => onChange("mock")} />
          <span><strong>Demo · mock mode</strong><small>Uses deterministic fixtures for scores and job facts. No AI provider is called.</small></span>
        </label>
      </div>
      {value === "anthropic" && <p className="notice" role="note">This sends your profile and job description to Claude and uses API credit.</p>}
      {value === "mock" && <p className="notice" role="note">Mock mode: scores and extracted job facts are deterministic fixtures, not an assessment of this role.</p>}
    </fieldset>
  );
}
