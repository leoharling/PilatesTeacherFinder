import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocode } from '@/lib/geocode';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(...responses: Array<{ body: unknown; ok?: boolean }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: r.ok ?? true, json: async () => r.body });
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('geocode', () => {
  it('returns lat/lng from the postal-code query', async () => {
    const fn = stubFetch({ body: [{ lat: '52.5321', lon: '13.3849' }] });
    const result = await geocode('10115', 'Berlin', 'Deutschland');
    expect(result).toEqual({ lat: 52.5321, lng: 13.3849 });
    expect(fn).toHaveBeenCalledTimes(1);
    const call = fn.mock.calls[0];
    expect(String(call[0])).toContain('nominatim.openstreetmap.org');
    expect(String(call[0])).toContain('postalcode=10115');
    expect(String(call[0])).not.toContain('city=');
    expect(call[1].headers['User-Agent']).toContain('PilatesTeacherFinder');
  });

  it('falls back to the city query when the postal code finds nothing', async () => {
    const fn = stubFetch(
      { body: [] },
      { body: [{ lat: '48.1371', lon: '11.5753' }] }
    );
    const result = await geocode('99999', 'München', 'Deutschland');
    expect(result).toEqual({ lat: 48.1371, lng: 11.5753 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(String(fn.mock.calls[1][0])).toContain('city=M%C3%BCnchen');
  });

  it('returns null when both queries find nothing', async () => {
    stubFetch({ body: [] }, { body: [] });
    expect(await geocode('00000', 'Nirgendwo', 'Deutschland')).toBeNull();
  });

  it('returns null on HTTP error or network failure', async () => {
    stubFetch({ body: {}, ok: false }, { body: {}, ok: false });
    expect(await geocode('10115', 'Berlin', 'Deutschland')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
    expect(await geocode('10115', 'Berlin', 'Deutschland')).toBeNull();
  });
});
