import { fireEvent, render, screen } from '@testing-library/svelte';
import { it, expect, vi } from 'vitest';
import Resizer from './Resizer.svelte';

const props = () => ({ axis: 'x' as const, label: 'Resize panel', ondrag: vi.fn(), ondragend: vi.fn(), onreset: vi.fn() });

it('reports horizontal pointer movement only while dragging', async () => {
  const p = props();
  render(Resizer, p);
  const handle = screen.getByRole('separator', { name: 'Resize panel' });

  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 360 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 420 });
  expect(p.ondrag).toHaveBeenLastCalledWith(420);
  expect(p.ondragend).not.toHaveBeenCalled();

  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 420 });
  expect(p.ondragend).toHaveBeenCalledTimes(1);

  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 });
  expect(p.ondrag).not.toHaveBeenCalledWith(500);
});

it('reports vertical pointer movement for the y axis', () => {
  const p = { ...props(), axis: 'y' as const };
  render(Resizer, p);
  const handle = screen.getByRole('separator', { name: 'Resize panel' });

  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 400 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 300 });

  expect(p.ondrag).toHaveBeenCalledWith(300);
});

it('resets on double click', async () => {
  const p = props();
  render(Resizer, p);
  await fireEvent.dblClick(screen.getByRole('separator', { name: 'Resize panel' }));
  expect(p.onreset).toHaveBeenCalledTimes(1);
});

it('takes its orientation from the axis', () => {
  render(Resizer, props());
  expect(screen.getByRole('separator', { name: 'Resize panel' })).toHaveAttribute('aria-orientation', 'vertical');
});
