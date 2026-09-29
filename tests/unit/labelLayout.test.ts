import { expect, it } from 'vitest';
import { spacedLabelIndices } from '@/lib/labelLayout';
it('keeps priority labels, drops collisions and clipped labels', () => {
  expect(spacedLabelIndices([
    {x:100,y:100,width:60,height:30},
    {x:110,y:110,width:60,height:30},
    {x:200,y:200,width:60,height:30},
    {x:5,y:10,width:60,height:30},
  ],390,600)).toEqual([0,2]);
});

it('keeps the first non-overlapping label in priority order', () => {
  expect(spacedLabelIndices([
    { x: 40, y: 40, width: 24, height: 16 },
    { x: 70, y: 40, width: 24, height: 16 },
    { x: 160, y: 40, width: 24, height: 16 },
  ], 200, 100)).toEqual([0, 2]);
});
