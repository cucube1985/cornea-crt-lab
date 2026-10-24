import {mkdir,writeFile} from 'node:fs/promises';

const value=process.env.CORNEA_SERVER_ORIGIN;
if(!value)throw new Error('Set the GitHub repository variable CORNEA_SERVER_ORIGIN after deploying and verifying the authenticated server.');
const url=new URL(value);
if(url.protocol!=='https:'||url.origin!==value||url.username||url.password)throw new Error('CORNEA_SERVER_ORIGIN must be an HTTPS origin without a path or trailing slash.');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;');
await mkdir('pages',{recursive:true});
await writeFile('pages/index.html',`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>CORNEA LAB · 로그인 서버</title><style>body{font-family:system-ui,sans-serif;background:#f4f7f9;color:#31545f;display:grid;place-items:center;min-height:90vh;margin:24px}main{background:white;border:1px solid #deeaec;border-radius:16px;padding:36px;max-width:430px}p{font-size:14px;line-height:1.8;color:#75909a}a{display:block;background:#326f65;color:white;text-decoration:none;text-align:center;padding:14px;border-radius:7px;margin-top:25px}</style></head><body><main><h1>CORNEA LAB</h1><p>로그인 후 각막과 CRT 렌즈 모델을 사용할 수 있습니다. 아래 버튼으로 로그인 서버를 여세요.</p><a href="${escape(url.origin)}/">로그인하고 시작하기</a></main></body></html>`);
console.log('GitHub Pages entry page prepared. Application assets are served only by the authenticated server.');
