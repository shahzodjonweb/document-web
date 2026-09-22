import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import dictionaries from '../locales/catalog.ts'
const keys=Object.keys(dictionaries.en).sort()
for(const locale of ['uz','ru']){
 assert.deepEqual(Object.keys(dictionaries[locale]).sort(),keys,`${locale} translation parity`)
 assert.ok(Object.values(dictionaries[locale]).every(value=>typeof value==='string'&&value.trim()))
}
assert.match(dictionaries.uz['pdf.merge.description'],/[‘’]/)
assert.match(dictionaries.ru['pdf.merge.name'],/[А-Яа-я]/)
const schemaBytes=await fs.readFile(new URL('../generated/api/public.openapi.json',import.meta.url))
const expected=(await fs.readFile(new URL('../generated/api/public.openapi.json.sha256',import.meta.url),'utf8')).trim().split(/\s/)[0]
assert.equal(createHash('sha256').update(schemaBytes).digest('hex'),expected,'Pinned public API checksum')
const schema=JSON.parse(schemaBytes)
assert.ok(!Object.keys(schema.paths).some(path=>/ops|staff|django-admin/.test(path)),'No staff routes in public contract')
console.log(`Pass: ${keys.length} keys × 3 complete locales; public schema SHA-256 verified; no staff routes`)
