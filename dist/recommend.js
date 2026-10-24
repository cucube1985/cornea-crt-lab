// Reads lens parameters from text copied out of an external CRT calculator.
// CORNEA LAB ships no recommendation formula of its own: the numbers come from
// whichever calculator the user ran, and are only parsed and range-checked here.

export const calculatorLinks=[
  {name:'VISUWORKS CRT Parameter Calculator',url:'https://visuworks-dev.github.io/ParagonCRT-Calculator/'}
];

export const resultFields=[
  {key:'k1',label:'K1 (Flat)',unit:'D',min:35,max:55,step:.25},
  {key:'k2',label:'K2 (Steep)',unit:'D',min:35,max:55,step:.25},
  {key:'ecc',label:'Ecc',unit:'선택',min:0,max:.89,step:.01,optional:true},
  {key:'bc',label:'BC',unit:'mm',min:7.5,max:10.5,step:.1},
  {key:'rzd1',label:'RZD1',unit:'µm',min:400,max:700,step:25},
  {key:'rzd2',label:'RZD2',unit:'µm',min:400,max:700,step:25,optional:true},
  {key:'lza',label:'LZA',unit:'°',min:25,max:45,step:1}
];

// Label spellings seen in calculator output, e.g. "BC: 8.3", "RZD1: 525", "OAD: 11.0".
const patterns={
  k1:/\bK\s*1\b[^\d\-]*(-?\d+(?:\.\d+)?)/i,
  k2:/\bK\s*2\b[^\d\-]*(-?\d+(?:\.\d+)?)/i,
  ecc:/\b(?<!flat\s?)ecc\b[^\d\-]*(\d*\.\d+|\d+)/i,
  bc:/\bBC\b[^\d]*(\d+(?:\.\d+)?)/i,
  rzd1:/\bRZD\s*1?\b[^\d]*(\d+)/i,
  rzd2:/\bRZD\s*2\b[^\d]*(\d+)/i,
  lza:/\bLZA\b[^\d]*(\d+(?:\.\d+)?)/i,
  oad:/\b(?:OAD|diameter)\b[^\d]*(\d+(?:\.\d+)?)/i
};

export function parseCalculatorText(text){
  const found={};
  for(const [key,pattern] of Object.entries(patterns)){
    const match=text.match(pattern);
    if(match){const value=Number(match[1]);if(Number.isFinite(value))found[key]=value;}
  }
  if(found.oad!==undefined)found.oad=Math.abs(found.oad-11)<Math.abs(found.oad-10.5)?11:10.5;
  // e.g. "Toric: CRT DA(toric) recommended" vs "Toric: CRT(spherical) available"
  const toricLine=text.split(/\r?\n/).find(line=>/toric|\bDA\b/i.test(line));
  if(toricLine)found.toric=/recommend|권장/i.test(toricLine)&&!/spherical|구면/i.test(toricLine);
  return found;
}
