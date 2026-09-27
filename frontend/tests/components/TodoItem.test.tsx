import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@solidjs/testing-library";
import TodoItem from "~/components/TodoItem";

const todo = { id: "t1", title: "Buy milk", completed: false, createdAt: "2026-01-01" };

describe("TodoItem", () => {
  it("renders the todo title and an unchecked checkbox", () => {
    render(() => <TodoItem todo={todo} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("renders a checked checkbox for a completed todo", () => {
    render(() => <TodoItem todo={{ ...todo, completed: true }} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onToggle with the todo id and new checked state", async () => {
    const onToggle = vi.fn();
    render(() => <TodoItem todo={todo} onToggle={onToggle} onDelete={vi.fn()} />);

    await fireEvent.click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledWith("t1", true);
  });

  it("calls onDelete with the todo id", async () => {
    const onDelete = vi.fn();
    render(() => <TodoItem todo={todo} onToggle={vi.fn()} onDelete={onDelete} />);

    await fireEvent.click(screen.getByRole("button", { name: /delete buy milk/i }));

    expect(onDelete).toHaveBeenCalledWith("t1");
  });
});
