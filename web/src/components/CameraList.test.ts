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
  expect(screen.getByText('Kota · Removed · dead')).toBeInTheDocument();
});

it('names the dataset and the owner', () => {
  const city = cam('kota-1', 'Simpang Tugu');
  const prov = { ...cam('prov-2', 'RingRoad', 'official', '', 'prov'), owner: 'Dinas Perhubungan DIY' } as Camera;
  render(CameraList, { ...base, liveness: { 'kota-1': 'alive', 'prov-2': 'alive' }, cameras: [city, prov] });
  expect(screen.getByText('Kota · Official')).toBeInTheDocument();
  expect(screen.getByText('Provinsi · Official')).toBeInTheDocument();
  expect(screen.getByText('Dinas Perhubungan DIY')).toBeInTheDocument();
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

it('shows Add to wall and reports the id', async () => {
  const onwall = vi.fn();
  const onselect = vi.fn();
  render(CameraList, { ...base, onselect, cameras: [cam('kota-1', 'Simpang Tugu')], wall: [], onwall });
  await userEvent.click(screen.getByText('Add to wall'));
  expect(onwall).toHaveBeenCalledWith('kota-1');
  expect(onselect).not.toHaveBeenCalled();
});

it('marks cameras already on the wall', () => {
  render(CameraList, { ...base, cameras: [cam('kota-1', 'A')], wall: ['kota-1'], onwall: vi.fn() });
  expect(screen.getByText('On wall')).toBeInTheDocument();
});

it('a full wall disables Add for others but not removal', () => {
  const wall = [...Array.from({ length: 7 }, (_, i) => `other-${i}`), 'kota-2'];
  render(CameraList, { ...base, cameras: [cam('kota-1', 'A'), cam('kota-2', 'B')], wall, onwall: vi.fn() });
  expect(screen.getByText('Wall is full')).toBeDisabled();
  expect(screen.getByText('On wall')).toBeEnabled();
});

it('shows no wall button without onwall', () => {
  render(CameraList, { ...base, cameras: [cam('kota-1', 'A')] });
  expect(screen.queryByText('Add to wall')).toBeNull();
});
