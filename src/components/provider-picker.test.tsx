import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { ProviderPicker } from "./provider-picker";

afterEach(cleanup);

describe("ProviderPicker", () => {
  it("identifies local, credit-using, and deterministic choices", () => {
    render(<ProviderPicker value="ollama" onChange={() => {}} />);
    expect(screen.getByText(/runs locally with ollama/i)).toBeVisible();
    expect(screen.getByText(/sending to claude uses api credit/i)).toBeVisible();
    expect(screen.getByText(/deterministic fixtures/i)).toBeVisible();
  });

  it("shows the exact data and credit disclosure when Claude is selected", () => {
    function Picker() {
      const [value, setValue] = useState<"ollama" | "anthropic" | "mock">("ollama");
      return <ProviderPicker value={value} onChange={setValue} />;
    }
    render(<Picker />);
    fireEvent.click(screen.getByRole("radio", { name: /claude/i }));
    expect(screen.getByText("This sends your profile and job description to Claude and uses API credit.")).toBeVisible();
  });
});
