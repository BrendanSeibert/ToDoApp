import { createUniqueId, onCleanup, onMount, Show, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { MdFillClose } from "solid-icons/md";
import { useI18n } from "~/context/I18nContext";
import "./Popover.scss";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: string;
  /** Id of an element in `children` that describes the dialog. */
  describedBy?: string;
  /** Use "alertdialog" for a confirmation that interrupts the user. */
  role?: "dialog" | "alertdialog";
  /** When false, Escape, the backdrop and the close button do nothing, e.g. while a request is in flight. */
  dismissible?: boolean;
  /** The element to focus on open; defaults to the close button. */
  initialFocus?: () => HTMLElement | undefined;
  children: JSX.Element;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

// Shared by every open popover, so they can open and close in any order without undoing each other.
interface OpenPopover {
  backdrop: HTMLElement;
}
// Oldest first. Only the last one reacts to the keyboard and is left interactive.
const openPopovers: OpenPopover[] = [];
// Page content this module made inert, so content that was already inert is never touched.
const madeInert = new Set<Element>();
let overflowBeforeOpen = "";

// Makes everything in <body> except the topmost popover inert, and releases the page once none is open.
function syncBackground() {
  madeInert.forEach((el) => {
    if (!el.isConnected) madeInert.delete(el);
  });

  const top = openPopovers[openPopovers.length - 1];
  if (!top) {
    madeInert.forEach((el) => el.removeAttribute("inert"));
    madeInert.clear();
    document.body.style.overflow = overflowBeforeOpen;
    return;
  }

  for (const el of Array.from(document.body.children)) {
    if (el.contains(top.backdrop)) {
      if (madeInert.delete(el)) el.removeAttribute("inert");
    } else if (!el.hasAttribute("inert")) {
      el.setAttribute("inert", "");
      madeInert.add(el);
    }
  }
}

function register(entry: OpenPopover) {
  if (openPopovers.length === 0) {
    overflowBeforeOpen = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  openPopovers.push(entry);
  syncBackground();
}

function unregister(entry: OpenPopover) {
  openPopovers.splice(openPopovers.indexOf(entry), 1);
  syncBackground();
}

export default function Popover(props: PopoverProps) {
  return (
    <Show when={props.open}>
      <Portal>
        {/* Rendered into document.body, so the backdrop covers the whole window whatever the ancestors are. */}
        <PopoverContent {...props} />
      </Portal>
    </Show>
  );
}

// Only exists while the popover is open, so its refs are always set when the setup below runs.
function PopoverContent(props: PopoverProps) {
  const { t } = useI18n();
  const titleId = createUniqueId();
  let backdrop!: HTMLDivElement;
  let panel!: HTMLDivElement;
  let closeButton!: HTMLButtonElement;

  const dismissible = () => props.dismissible !== false;
  const dismiss = () => {
    if (dismissible()) props.onClose();
  };

  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    const entry: OpenPopover = { backdrop };
    register(entry);

    (props.initialFocus?.() ?? closeButton).focus();

    // Capture phase on window, so this runs before any document-level handler.
    const onKeyDown = (event: KeyboardEvent) => {
      if (openPopovers[openPopovers.length - 1] !== entry) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;

      // Keep Tab inside the dialog.
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!first) {
        // Everything is disabled (e.g. mid-request); park focus on the panel itself.
        event.preventDefault();
        panel.focus();
      } else if (!panel.contains(active) || active === panel || (event.shiftKey && active === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown, true);
      unregister(entry);
      opener?.focus();
    });
  });

  return (
    <div
      class="d-popover popover"
      ref={backdrop}
      onMouseDown={(event) => {
        // Only a press on the backdrop itself closes it, not one that starts inside the panel.
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        class="popover-panel"
        role={props.role ?? "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={props.describedBy}
        tabindex="-1"
        ref={panel}
      >
        <h2 id={titleId} class="popover-title">
          {props.title}
        </h2>
        <button
          type="button"
          class="popover-close"
          title={t("popover.close")}
          aria-label={t("popover.close")}
          disabled={!dismissible()}
          ref={closeButton}
          onClick={dismiss}
        >
          <MdFillClose size={20} aria-hidden="true" />
        </button>
        {props.children}
      </div>
    </div>
  );
}
