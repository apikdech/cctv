import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import CameraList from './CameraList.svelte';
import type { Camera, LivenessMap, Toggles } from '../lib/types';

const cam = (id: string, title: string, source: Camera['source'] = 'official', kecamatan = 'JETIS', dataset: Camera['dataset'] = 'kota'): Camera =>
  ({ id, ref: 1, dataset, title, url: '', lat: 0, lon: 0, kecamatan, kelurahan: '', owner: '', slug: '', source, lastSeen: null });
const toggles: Toggles = { kota: true, prov: true, removed: true, dead: true };
const base = { liveness: { 'kota-2': 'dead' } as LivenessMap, toggles, ontoggle: vi.fn(), onselect: vi.fn(), onhover: vi.fn() };

it('filters as you type and shows the count', async () => {
  render(CameraList, { ...base, cameras: [cam('kota-1', 'Simpang Tugu'), cam('kota-2', 'Malioboro_Mall_Utara', 'removed', '')] });
  expect(screen.getByText('2 cameras')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText(/Search camera/), 'malioboro');
  expect(screen.getByText('1 cameras')).toBeInTheDocument();
  expect(screen.getByText('Malioboro Mall Utara')).toBeInTheDocument();
  expect(screen.getByText('Removed · dead')).toBeInTheDocument();
});

it('click selects, hover reports, toggle emits new toggles', async () => {
  render(CameraList, { ...base, cameras: [cam('kota-1', 'Simpang Tugu')] });
  await userEvent.hover(screen.getByText('Simpang Tugu'));
  expect(base.onhover).toHaveBeenCalledWith('kota-1');
  await userEvent.click(screen.getByText('Simpang Tugu'));
  expect(base.onselect).toHaveBeenCalledWith('kota-1');
  await userEvent.click(screen.getByLabelText('Dead'));
  expect(base.ontoggle).toHaveBeenCalledWith({ kota: true, prov: true, removed: true, dead: false });
});

it('offers four toggles', async () => {
  render(CameraList, { ...base, cameras: [] });
  for (const label of ['Kota', 'Provinsi', 'Removed', 'Dead']) expect(screen.getByLabelText(label)).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('Provinsi'));
  expect(base.ontoggle).toHaveBeenCalledWith({ kota: true, prov: false, removed: true, dead: true });
});

it('group mode shows title and back button', async () => {
  const onback = vi.fn();
  render(CameraList, { ...base, cameras: [cam('kota-1', 'A'), cam('kota-3', 'B')], title: '2 cameras here', onback });
  await userEvent.click(screen.getByText('← back to list'));
  expect(onback).toHaveBeenCalled();
});
