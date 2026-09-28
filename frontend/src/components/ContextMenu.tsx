import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import "./ContextMenu.scss";

export interface ContextMenuItem {
  title: string;
  onSelect: () => void;
  /** Pass a getter (e.g. `() => !ready()`) to change it while the menu is mounted. */
  disabled?: boolean | (() => boolean);
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  label: string;
}

function isDisabled(item: ContextMenuItem): boolean {
  return typeof item.disabled === "function" ? item.disabled() : Boolean(item.disabled);
}

export default function ContextMenu(props: ContextMenuProps) {
  const [open, setOpen] = createSignal(false);
  let wrapper: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;

  createEffect(() => {
    if (!open()) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (wrapper && !wrapper.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    onCleanup(() => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    });
  });

  function select(item: ContextMenuItem) {
    if (isDisabled(item)) return;
    item.onSelect();
    setOpen(false);
  }

  return (
    <div class="d-context-menu context-menu" ref={wrapper}>
      <button
        type="button"
        class="context-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open()}
        ref={trigger}
        onClick={() => setOpen((current) => !current)}
      >
        {props.label}
      </button>
      <Show when={open()}>
        <ul class="context-menu-list" role="menu">
          <For each={props.items}>
            {(item) => (
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  class="context-menu-item"
                  title={item.title}
                  disabled={isDisabled(item)}
                  onClick={() => select(item)}
                >
                  {item.title}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
