import { describe, expect, it, vi } from "vitest";
import { createSignal } from "solid-js";
import { fireEvent, screen } from "@solidjs/testing-library";
import { renderWithI18n } from "../helpers/renderWithI18n";
import Popover, { type PopoverProps } from "~/components/Popover";

const closeButton = () => screen.getByRole("button", { name: "Close" });

function renderPopover(open = true, onClose = vi.fn(), extra: Partial<PopoverProps> = {}) {
  renderWithI18n(() => (
    <Popover open={open} onClose={onClose} title="Example dialog" {...extra}>
      <p>Popover body</p>
      <button type="button">First</button>
      <button type="button">Last</button>
    </Popover>
  ));
  return onClose;
}

describe("Popover", () => {
  it("renders nothing while closed", () => {
    renderPopover(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Popover body")).not.toBeInTheDocument();
  });

  it("renders an accessible modal dialog with its children into document.body", () => {
    const { baseElement, container } = renderWithI18n(() => (
      <Popover open onClose={vi.fn()} title="Example dialog">
        <p>Popover body</p>
      </Popover>
    ));

    const dialog = screen.getByRole("dialog", { name: "Example dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Popover body");
    // Portaled: not inside the element the component was rendered into.
    expect(container).not.toContainElement(dialog);
    expect(baseElement).toContainElement(dialog);
  });

  it("covers the window with a backdrop behind the panel", () => {
    const { container } = renderWithI18n(() => (
      <Popover open onClose={vi.fn()} title="Example dialog">
        <p>Popover body</p>
      </Popover>
    ));

    const backdrop = screen.getByRole("dialog").parentElement!;
    expect(backdrop).toHaveClass("popover");
    // Mounted under <body> rather than inside the component's own parent.
    expect(document.body).toContainElement(backdrop);
    expect(container).not.toContainElement(backdrop);
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = renderPopover();

    await fireEvent.click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = renderPopover();

    await fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", async () => {
    const onClose = renderPopover();

    await fireEvent.keyDown(document, { key: "a" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is pressed", async () => {
    const onClose = renderPopover();

    await fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the press is inside the panel", async () => {
    const onClose = renderPopover();

    await fireEvent.mouseDown(screen.getByRole("dialog"));
    await fireEvent.mouseDown(screen.getByText("Popover body"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when a press starts in the panel and is released on the backdrop", async () => {
    const onClose = renderPopover();
    const backdrop = screen.getByRole("dialog").parentElement!;

    await fireEvent.mouseDown(screen.getByText("Popover body"));
    await fireEvent.mouseUp(backdrop);
    await fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops listening for Escape once it has closed", async () => {
    const [open, setOpen] = createSignal(true);
    const onClose = vi.fn();
    renderWithI18n(() => (
      <Popover open={open()} onClose={onClose} title="Example dialog">
        <p>Popover body</p>
      </Popover>
    ));

    setOpen(false);
    await fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("accessible name and role", () => {
    it("is labelled by its visible heading and described by the element it points at", () => {
      renderWithI18n(() => (
        <Popover open onClose={vi.fn()} title="Example dialog" describedBy="body-text">
          <p id="body-text">Popover body</p>
        </Popover>
      ));

      expect(screen.getByRole("heading", { name: "Example dialog" })).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Example dialog", description: "Popover body" })).toBeInTheDocument();
    });

    it("can be an alertdialog", () => {
      renderPopover(true, vi.fn(), { role: "alertdialog" });

      expect(screen.getByRole("alertdialog", { name: "Example dialog" })).toHaveAttribute("aria-modal", "true");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("dismissible", () => {
    it("ignores Escape, the backdrop and the close button while not dismissible", async () => {
      const onClose = renderPopover(true, vi.fn(), { dismissible: false });

      await fireEvent.keyDown(document, { key: "Escape" });
      await fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
      await fireEvent.click(closeButton());

      expect(closeButton()).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("dismisses again once it becomes dismissible", async () => {
      const [dismissible, setDismissible] = createSignal(false);
      const onClose = vi.fn();
      renderWithI18n(() => (
        <Popover open onClose={onClose} title="Example dialog" dismissible={dismissible()}>
          <p>Popover body</p>
        </Popover>
      ));

      await fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      setDismissible(true);
      await fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("still keeps Escape from reaching other handlers while not dismissible", async () => {
      renderPopover(true, vi.fn(), { dismissible: false });
      const documentHandler = vi.fn();
      document.addEventListener("keydown", documentHandler);

      await fireEvent.keyDown(document, { key: "Escape" });
      document.removeEventListener("keydown", documentHandler);

      expect(documentHandler).not.toHaveBeenCalled();
    });
  });

  describe("keyboard isolation", () => {
    it("stops Escape reaching document-level handlers", async () => {
      renderPopover();
      const documentHandler = vi.fn();
      document.addEventListener("keydown", documentHandler);

      await fireEvent.keyDown(document, { key: "Escape" });
      document.removeEventListener("keydown", documentHandler);

      expect(documentHandler).not.toHaveBeenCalled();
    });

    it("lets Escape through once it has closed", async () => {
      const [open, setOpen] = createSignal(true);
      renderWithI18n(() => (
        <Popover open={open()} onClose={vi.fn()} title="Example dialog">
          <p>Popover body</p>
        </Popover>
      ));
      const documentHandler = vi.fn();
      document.addEventListener("keydown", documentHandler);

      setOpen(false);
      await fireEvent.keyDown(document, { key: "Escape" });
      document.removeEventListener("keydown", documentHandler);

      expect(documentHandler).toHaveBeenCalledTimes(1);
    });

    it("lets only the topmost of two popovers react", async () => {
      const [secondOpen, setSecondOpen] = createSignal(true);
      const closeFirst = vi.fn();
      const closeSecond = vi.fn();
      renderWithI18n(() => (
        <>
          <Popover open onClose={closeFirst} title="First dialog">
            <p>First body</p>
          </Popover>
          <Popover open={secondOpen()} onClose={closeSecond} title="Second dialog">
            <p>Second body</p>
          </Popover>
        </>
      ));

      await fireEvent.keyDown(document, { key: "Escape" });
      expect(closeSecond).toHaveBeenCalledTimes(1);
      expect(closeFirst).not.toHaveBeenCalled();

      setSecondOpen(false);
      await fireEvent.keyDown(document, { key: "Escape" });
      expect(closeFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe("background", () => {
    it("makes the rest of the page inert while open and restores it on close", () => {
      const [open, setOpen] = createSignal(false);
      const { container } = renderWithI18n(() => (
        <>
          <button type="button">Behind</button>
          <Popover open={open()} onClose={vi.fn()} title="Example dialog">
            <p>Popover body</p>
          </Popover>
        </>
      ));

      setOpen(true);
      expect(container).toHaveAttribute("inert");
      expect(screen.getByRole("dialog").closest("[inert]")).toBeNull();

      setOpen(false);
      expect(container).not.toHaveAttribute("inert");
    });

    it("leaves content that was already inert alone", () => {
      const preInert = document.createElement("div");
      preInert.setAttribute("inert", "");
      document.body.append(preInert);
      const [open, setOpen] = createSignal(true);
      renderWithI18n(() => (
        <Popover open={open()} onClose={vi.fn()} title="Example dialog">
          <p>Popover body</p>
        </Popover>
      ));

      setOpen(false);

      expect(preInert).toHaveAttribute("inert");
      preInert.remove();
    });

    describe("with two popovers open", () => {
      function renderTwo() {
        const [firstOpen, setFirstOpen] = createSignal(true);
        const [secondOpen, setSecondOpen] = createSignal(true);
        const { container } = renderWithI18n(() => (
          <>
            <Popover open={firstOpen()} onClose={vi.fn()} title="First dialog">
              <p>First body</p>
            </Popover>
            <Popover open={secondOpen()} onClose={vi.fn()} title="Second dialog">
              <p>Second body</p>
            </Popover>
          </>
        ));
        const wrapperOf = (title: string) => screen.getByRole("dialog", { name: title }).closest("body > *")!;
        return { container, setFirstOpen, setSecondOpen, wrapperOf };
      }

      it("leaves only the topmost one interactive", () => {
        const { container, wrapperOf } = renderTwo();

        expect(container).toHaveAttribute("inert");
        expect(wrapperOf("First dialog")).toHaveAttribute("inert");
        expect(wrapperOf("Second dialog")).not.toHaveAttribute("inert");
      });

      it("keeps the page locked when the older one closes first, and releases it after the last", () => {
        document.body.style.overflow = "scroll";
        const { container, setFirstOpen, setSecondOpen, wrapperOf } = renderTwo();

        setFirstOpen(false);
        expect(document.body.style.overflow).toBe("hidden");
        expect(container).toHaveAttribute("inert");
        expect(wrapperOf("Second dialog")).not.toHaveAttribute("inert");

        setSecondOpen(false);
        expect(document.body.style.overflow).toBe("scroll");
        expect(container).not.toHaveAttribute("inert");
        document.body.style.overflow = "";
      });

      it("makes the older one interactive again when the newer one closes first", () => {
        const { setSecondOpen, wrapperOf } = renderTwo();

        setSecondOpen(false);

        expect(wrapperOf("First dialog")).not.toHaveAttribute("inert");
      });
    });

    it("locks body scroll while open and restores the previous value", () => {
      document.body.style.overflow = "scroll";
      const [open, setOpen] = createSignal(false);
      renderWithI18n(() => (
        <Popover open={open()} onClose={vi.fn()} title="Example dialog">
          <p>Popover body</p>
        </Popover>
      ));

      setOpen(true);
      expect(document.body.style.overflow).toBe("hidden");
      setOpen(false);

      expect(document.body.style.overflow).toBe("scroll");
      document.body.style.overflow = "";
    });
  });

  describe("focus", () => {
    it("moves focus to the close button when it opens", () => {
      renderPopover();

      expect(closeButton()).toHaveFocus();
    });

    it("focuses the element chosen by initialFocus instead of the close button", () => {
      renderWithI18n(() => (
        <Popover open onClose={vi.fn()} title="Example dialog" initialFocus={() => document.getElementById("pick") ?? undefined}>
          <button type="button" id="pick">
            Pick me
          </button>
        </Popover>
      ));

      expect(screen.getByRole("button", { name: "Pick me" })).toHaveFocus();
    });

    it("falls back to the close button when initialFocus finds nothing", () => {
      renderPopover(true, vi.fn(), { initialFocus: () => undefined });

      expect(closeButton()).toHaveFocus();
    });

    it("returns focus to whatever had it before, when it closes", () => {
      const [open, setOpen] = createSignal(false);
      renderWithI18n(() => (
        <>
          <button type="button">Opener</button>
          <Popover open={open()} onClose={vi.fn()} title="Example dialog">
            <p>Popover body</p>
          </Popover>
        </>
      ));
      const opener = screen.getByRole("button", { name: "Opener" });
      opener.focus();

      setOpen(true);
      expect(closeButton()).toHaveFocus();
      setOpen(false);

      expect(opener).toHaveFocus();
    });

    it("keeps Tab inside the dialog", async () => {
      renderPopover();
      const last = screen.getByRole("button", { name: "Last" });
      last.focus();

      await fireEvent.keyDown(last, { key: "Tab" });
      expect(closeButton()).toHaveFocus();

      await fireEvent.keyDown(closeButton(), { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
    });

    it("lets Tab move normally between controls inside the dialog", async () => {
      renderPopover();
      const first = screen.getByRole("button", { name: "First" });
      first.focus();

      // fireEvent resolves to false when the default action was prevented.
      expect(await fireEvent.keyDown(first, { key: "Tab" })).toBe(true);
      expect(await fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(true);
    });

    it("pulls focus back in when Tab is pressed from outside the dialog", async () => {
      renderWithI18n(() => (
        <>
          <button type="button">Outside</button>
          <Popover open onClose={vi.fn()} title="Example dialog">
            <p>Popover body</p>
          </Popover>
        </>
      ));
      const outside = screen.getByRole("button", { name: "Outside" });
      outside.focus();

      await fireEvent.keyDown(outside, { key: "Tab" });

      expect(closeButton()).toHaveFocus();
    });

    it("keeps Tab and Shift+Tab on the close button when it is the only control", async () => {
      renderWithI18n(() => (
        <Popover open onClose={vi.fn()} title="Example dialog">
          <p>Popover body</p>
        </Popover>
      ));

      expect(await fireEvent.keyDown(closeButton(), { key: "Tab" })).toBe(false);
      expect(closeButton()).toHaveFocus();
      expect(await fireEvent.keyDown(closeButton(), { key: "Tab", shiftKey: true })).toBe(false);
      expect(closeButton()).toHaveFocus();
    });

    it("parks focus on the panel when nothing inside can take it", async () => {
      renderWithI18n(() => (
        <Popover open onClose={vi.fn()} title="Example dialog" dismissible={false}>
          <p>Popover body</p>
        </Popover>
      ));

      await fireEvent.keyDown(document, { key: "Tab" });

      expect(screen.getByRole("dialog")).toHaveFocus();
    });

    it("moves focus in when Tab is pressed from the panel itself or from body", async () => {
      renderPopover();
      const panel = screen.getByRole("dialog");
      const last = screen.getByRole("button", { name: "Last" });

      panel.focus();
      await fireEvent.keyDown(panel, { key: "Tab" });
      expect(closeButton()).toHaveFocus();

      panel.focus();
      await fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();

      (document.activeElement as HTMLElement).blur();
      await fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
    });
  });
});
