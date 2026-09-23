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
