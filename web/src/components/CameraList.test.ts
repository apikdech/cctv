import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import CameraList from './CameraList.svelte';
import type { Camera, LivenessMap } from '../lib/types';

const cam = (id: number, title: string, source: Camera['source'] = 'official', kecamatan = 'JETIS'): Camera =>
  ({ id, title, url: '', lat: 0, lon: 0, kecamatan, kelurahan: '', source, lastSeen: null });
const base = { liveness: { 2: 'dead' } as LivenessMap, toggles: { official: true, removed: true, dead: true }, ontoggle: vi.fn(), onselect: vi.fn(), onhover: vi.fn() };

it('filters as you type and shows the count', async () => {
  render(CameraList, { ...base, cameras: [cam(1, 'Simpang Tugu'), cam(2, 'Malioboro_Mall_Utara', 'removed', '')] });
  expect(screen.getByText('2 cameras')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText('Search camera…'), 'malioboro');
  expect(screen.getByText('1 cameras')).toBeInTheDocument();
  expect(screen.getByText('Malioboro Mall Utara')).toBeInTheDocument();
  expect(screen.getByText('Removed · dead')).toBeInTheDocument();
});

it('click selects, hover reports, toggle emits new toggles', async () => {
  render(CameraList, { ...base, cameras: [cam(1, 'Simpang Tugu')] });
  await userEvent.hover(screen.getByText('Simpang Tugu'));
  expect(base.onhover).toHaveBeenCalledWith(1);
  await userEvent.click(screen.getByText('Simpang Tugu'));
  expect(base.onselect).toHaveBeenCalledWith(1);
  await userEvent.click(screen.getByLabelText('Dead'));
  expect(base.ontoggle).toHaveBeenCalledWith({ official: true, removed: true, dead: false });
});

it('group mode shows title and back button', async () => {
  const onback = vi.fn();
  render(CameraList, { ...base, cameras: [cam(1, 'A'), cam(3, 'B')], title: '2 cameras here', onback });
  await userEvent.click(screen.getByText('← back to list'));
  expect(onback).toHaveBeenCalled();
});
