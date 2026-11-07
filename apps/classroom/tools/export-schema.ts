/**
 * Xuất JSON Schema của gói bài học (từ schema zod) ra docs/schema/ —
 * "hợp đồng" máy đọc được để AI (Claude) sinh nội dung đúng định dạng.
 *   npm run schema
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { assetManifestSchema, catalogSchema, packageSchema } from './schema';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'schema');
mkdirSync(out, { recursive: true });
const write = (name: string, s: z.ZodType) =>
  writeFileSync(join(out, name), JSON.stringify(z.toJSONSchema(s, { unrepresentable: 'any', reused: 'ref' }), null, 2) + '\n');
write('lesson-package.schema.json', packageSchema);
write('asset-manifest.schema.json', assetManifestSchema);
write('catalog.schema.json', catalogSchema);
console.log(`✓ Đã ghi JSON Schema vào ${out}`);
