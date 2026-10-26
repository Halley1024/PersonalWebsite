import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = new URL('../../backend/docs/api-types.ts', import.meta.url);
const target = new URL('../src/shared/api/generated.ts', import.meta.url);
await mkdir(new URL('.', target), { recursive: true });
await writeFile(target, await readFile(source));
console.log('已同步后端接口类型');
