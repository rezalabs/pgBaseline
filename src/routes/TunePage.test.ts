import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SITE_DESCRIPTION } from '../lib/model/meta';
import TunePage from './TunePage.svelte';

function resetLocation(): void {
  window.history.replaceState({}, '', '/');
}

describe('Tune page', () => {
  beforeEach(resetLocation);
  afterEach(cleanup);

  it('starts in the empty state with worked examples', () => {
    render(TunePage);
    expect(screen.getByText('Enter total memory to generate a configuration.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Small web server/ })).toBeTruthy();
  });

  it('carries the site description under the heading', () => {
    render(TunePage);
    expect(screen.getByText(SITE_DESCRIPTION)).toBeTruthy();
  });

  it('generates a configuration from an example and writes it to the URL', async () => {
    render(TunePage);
    await fireEvent.click(screen.getByRole('button', { name: /Small web server/ }));

    await waitFor(() => expect(screen.getByText('Memory ledger')).toBeTruthy());

    const code = document.querySelector('.code')?.textContent ?? '';
    expect(code).toContain('shared_buffers = 2GB');
    expect(code).toContain('max_connections = 200');
    expect(code).toContain('effective_io_concurrency = 200');

    await waitFor(() => expect(window.location.search).toContain('ram=8'));
    expect(window.location.search).toContain('cpus=4');
  });

  it('reports an invalid memory value next to the field', async () => {
    render(TunePage);
    const input = screen.getByLabelText('Total memory (RAM)');
    await fireEvent.input(input, { target: { value: '0' } });
    await fireEvent.blur(input);

    await waitFor(() => expect(screen.getByText('Use a value of at least 1.')).toBeTruthy());
    expect(screen.queryByText('Memory ledger')).toBeNull();
  });

  it('restores a complete configuration from the URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/?version=16&os=windows&workload=dw&ram=32&ramUnit=GB&cpus=8&connections=100&storage=nvme&dbSize=larger',
    );
    render(TunePage);

    await waitFor(() => expect(screen.getByText('Memory ledger')).toBeTruthy());
    const code = document.querySelector('.code')?.textContent ?? '';
    expect(code).toContain('# 16 on Windows, 8 vCPU, 32GB RAM');
    expect(screen.queryByText('io_method = io_uring')).toBeNull();
  });
});
