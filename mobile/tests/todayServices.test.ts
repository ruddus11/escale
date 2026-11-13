import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const store=vi.hoisted(()=>new Map<string,string>());
vi.mock('../src/data/sqlite',()=>({todayStore:{get:async(key:string)=>store.get(key)??null,set:async(key:string,value:string)=>{store.set(key,value);}}}));
import { loadWeather } from '../src/data/todayServices';
beforeEach(()=>store.clear());
afterEach(()=>vi.unstubAllGlobals());
describe('today API fallback',()=>{
  it('keeps weather caches scoped to their trip city',async()=>{
    const weather={temperature:18,code:3,at:'2026-11-12T05:00:00Z'};
    store.set('weather:kyoto',JSON.stringify(weather));
    vi.stubGlobal('fetch',async()=>{throw Error('offline');});
    expect(await loadWeather('교토')).toEqual({value:weather,cached:true});
    expect(await loadWeather('도쿄')).toEqual({value:null,cached:true});
    expect(await loadWeather('')).toEqual({value:null,cached:true});
  });
  it('validates the city and weather response before caching',async()=>{
    vi.stubGlobal('fetch',async(url:string)=>new Response(JSON.stringify(url.includes('geocoding')?{results:[{latitude:35,longitude:135}]}:{current:{temperature_2m:18,weather_code:3,time:1794459600}})));
    const result=await loadWeather('교토');
    expect(result.cached).toBe(false);
    expect(result.value?.temperature).toBe(18);
    expect(store.has('weather:kyoto')).toBe(true);
  });
});
