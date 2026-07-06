import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocode } from '@/lib/geocode';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      json: async () => response,
    }))
  );
}

describe('geocode', () => {
  it('returns lat/lng from the first Nominatim result', async () => {
    stubFetch([{ lat: '52.5321', lon: '13.3849' }]);
    const result = await geocode('10115', 'Berlin', 'Deutschland');
    expect(result).toEqual({ lat: 52.5321, lng: 13.3849 });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toContain('nominatim.openstreetmap.org');
    expect(String(call[0])).toContain('postalcode=10115');
    expect(call[1].headers['User-Agent']).toContain('PilatesTeacherFinder');
  });

  it('returns null when Nominatim finds nothing', async () => {
    stubFetch([]);
    expect(await geocode('00000', 'Nirgendwo', 'Deutschland')).toBeNull();
  });

  it('returns null on HTTP error or network failure', async () => {
    stubFetch({}, false);
    expect(await geocode('10115', 'Berlin', 'Deutschland')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    expect(await geocode('10115', 'Berlin', 'Deutschland')).toBeNull();
  });
});
