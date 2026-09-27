import { createSignal } from "solid-js";
import type { User } from "~/api/auth";

const [user, setUser] = createSignal<User | null>(null);
const [initializing, setInitializing] = createSignal(true);

export { user, initializing };

export function setCurrentUser(nextUser: User | null): void {
  setUser(nextUser);
}

export function finishInitializing(): void {
  setInitializing(false);
}
