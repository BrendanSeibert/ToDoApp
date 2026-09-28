import { describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import ContextMenu from "~/components/ContextMenu";

const trigger = () => screen.getByRole("button", { name: "Actions" });

describe("ContextMenu", () => {
  it("renders only the trigger button until it is clicked", () => {
    render(() => <ContextMenu label="Actions" items={[{ title: "Edit", onSelect: vi.fn() }]} />);

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens a menu with one entry per item, in order, when the trigger is clicked", async () => {
    const items = [
      { title: "Edit", onSelect: vi.fn() },
      { title: "Rename", onSelect: vi.fn() },
      { title: "Delete", onSelect: vi.fn() },
    ];
    render(() => <ContextMenu label="Actions" items={items} />);

    await fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem").map((entry) => entry.textContent)).toEqual(["Edit", "Rename", "Delete"]);
  });

  it.each([1, 20])("renders %i entries", async (count) => {
    const items = Array.from({ length: count }, (_, index) => ({ title: `Option ${index}`, onSelect: vi.fn() }));
    render(() => <ContextMenu label="Actions" items={items} />);

    await fireEvent.click(trigger());

    expect(screen.getAllByRole("menuitem")).toHaveLength(count);
  });

  it("closes the menu when the trigger is clicked again", async () => {
    render(() => <ContextMenu label="Actions" items={[{ title: "Edit", onSelect: vi.fn() }]} />);

    await fireEvent.click(trigger());
    await fireEvent.click(trigger());

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("calls only the paired function once and closes the menu when an entry is clicked", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(() => (
      <ContextMenu
        label="Actions"
        items={[
          { title: "Edit", onSelect: onEdit },
          { title: "Delete", onSelect: onDelete },
        ]}
      />
    ));

    await fireEvent.click(trigger());
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("puts the full title in a tooltip so truncated titles can still be read", async () => {
    const title = "A very long option title that cannot fit";
    render(() => <ContextMenu label="Actions" items={[{ title, onSelect: vi.fn() }]} />);

    await fireEvent.click(trigger());

    expect(screen.getByRole("menuitem")).toHaveAttribute("title", title);
  });

  it("closes when clicking outside the menu", async () => {
    render(() => (
      <div>
        <p>elsewhere</p>
        <ContextMenu label="Actions" items={[{ title: "Edit", onSelect: vi.fn() }]} />
      </div>
    ));

    await fireEvent.click(trigger());
    await fireEvent.mouseDown(screen.getByText("elsewhere"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays open when pressing inside the menu on something that is not an entry", async () => {
    render(() => <ContextMenu label="Actions" items={[{ title: "Edit", onSelect: vi.fn() }]} />);

    await fireEvent.click(trigger());
    await fireEvent.mouseDown(screen.getByRole("menu"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes when Escape is pressed and returns focus to the trigger", async () => {
    render(() => <ContextMenu label="Actions" items={[{ title: "Edit", onSelect: vi.fn() }]} />);

    await fireEvent.click(trigger());
    await fireEvent.keyDown(document.body, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("ignores other keys", async () => {
    render(() => <ContextMenu label="Actions" items={[{ title: "Edit", onSelect: vi.fn() }]} />);

    await fireEvent.click(trigger());
    await fireEvent.keyDown(document.body, { key: "a" });

    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  describe("disabled entries", () => {
    it("renders a disabled entry that does nothing and leaves the menu open when clicked", async () => {
      const onSoon = vi.fn();
      render(() => (
        <ContextMenu label="Actions" items={[{ title: "Soon", onSelect: onSoon, disabled: true }]} />
      ));

      await fireEvent.click(trigger());
      const entry = screen.getByRole("menuitem", { name: "Soon" });
      await fireEvent.click(entry);

      expect(entry).toBeDisabled();
      expect(onSoon).not.toHaveBeenCalled();
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("leaves other entries in the same menu clickable", async () => {
      const onEdit = vi.fn();
      render(() => (
        <ContextMenu
          label="Actions"
          items={[
            { title: "Edit", onSelect: onEdit },
            { title: "Soon", onSelect: vi.fn(), disabled: true },
          ]}
        />
      ));

      await fireEvent.click(trigger());
      await fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));

      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("updates a disabled entry reactively while the menu is open", async () => {
      const onExport = vi.fn();
      const [ready, setReady] = createSignal(false);
      render(() => (
        <ContextMenu label="Actions" items={[{ title: "Export", onSelect: onExport, disabled: () => !ready() }]} />
      ));

      await fireEvent.click(trigger());
      expect(screen.getByRole("menuitem", { name: "Export" })).toBeDisabled();

      setReady(true);

      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Export" })).toBeEnabled();
      await fireEvent.click(screen.getByRole("menuitem", { name: "Export" }));
      expect(onExport).toHaveBeenCalledTimes(1);
    });
  });
});
