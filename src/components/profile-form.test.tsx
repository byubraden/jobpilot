import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./profile-form";

afterEach(cleanup);

describe("ProfileForm", () => {
  it("exposes all candidate facts needed for truthful drafts", () => {
    render(<ProfileForm profile={null} onSave={vi.fn()} />);
    for (const label of [/headline/i, /education/i, /internships/i, /projects/i, /skills/i, /preferences/i, /résumé text/i]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
  });
  it("submits profile facts and shows the saved version", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true, data: { version: 3 } });
    render(<ProfileForm profile={null} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/headline/i), { target: { value: "Engineer" } });
    fireEvent.change(screen.getByLabelText(/projects/i), { target: { value: "Built a UI" } });
    fireEvent.change(screen.getByLabelText(/skills/i), { target: { value: "React" } });
    fireEvent.change(screen.getByLabelText(/résumé text/i), { target: { value: "Engineer with React projects" } });
    fireEvent.submit(screen.getByRole("button", { name: /save profile/i }).closest("form")!);
    await waitFor(() => expect(screen.getByText(/profile version 3 saved/i)).toBeVisible());
    expect((onSave.mock.calls[0][0] as FormData).get("headline")).toBe("Engineer");
  });
});
