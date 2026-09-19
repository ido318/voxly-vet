import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Drawer } from "@/components/dashboard/ui/drawer";

afterEach(() => {
  cleanup();
});

describe("Modal focus trap", () => {
  it("moves focus to the first focusable element on open", async () => {
    render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
        <button type="button">בטל</button>
      </Modal>,
    );

    // Close button renders before the children, so it's first in tab order.
    expect(await screen.findByRole("button", { name: "סגור" })).toHaveFocus();
  });

  it("wraps Tab from the last focusable element back to the first", async () => {
    render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole("button", { name: "סגור" });
    const saveButton = screen.getByRole("button", { name: "שמור" });

    saveButton.focus();
    expect(saveButton).toHaveFocus();

    fireEvent.keyDown(saveButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element to the last", async () => {
    render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );

    const closeButton = await screen.findByRole("button", { name: "סגור" });
    const saveButton = screen.getByRole("button", { name: "שמור" });

    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(saveButton).toHaveFocus();
  });

  it("restores focus to the trigger element on close", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "פתח";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );
    await screen.findByRole("button", { name: "סגור" });

    rerender(
      <Modal open={false} onClose={vi.fn()} title="כותרת">
        <button type="button">שמור</button>
      </Modal>,
    );

    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});

// role="dialog" + aria-modal with no accessible name announces as just
// "dialog": a screen-reader user is told a modal opened but not what it is
// for. Both components set the role and trap focus correctly and neither
// carried a name — the Drawer's title was a <p>, so it was not even a
// heading to point at.
describe("dialog accessible names", () => {
  it("names the modal from its title", () => {
    render(
      <Modal open onClose={() => {}} title="אישור מחיקה">
        <p>תוכן</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "אישור מחיקה" })).toBeInTheDocument();
  });

  it("names the drawer from its title, and that title is a heading", () => {
    render(
      <Drawer open onClose={() => {}} title="כרטיס לקוח">
        <p>תוכן</p>
      </Drawer>,
    );

    expect(screen.getByRole("dialog", { name: "כרטיס לקוח" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "כרטיס לקוח" })).toBeInTheDocument();
  });

  it("leaves aria-labelledby off when there is no title to point at", () => {
    render(
      <Drawer open onClose={() => {}}>
        <p>תוכן</p>
      </Drawer>,
    );

    // A dangling aria-labelledby is worse than none: it names the dialog
    // after an element that does not exist.
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-labelledby");
  });
});
