// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const wid = '33333333-3333-4333-8333-333333333333';
const pid = '44444444-4444-4444-8444-444444444444';
const cid = '55555555-5555-4555-8555-555555555555';
const aid = '66666666-6666-4666-8666-666666666666';
let db: PGlite;
const data = () => ({workers:[{id:wid,user_id:uid,name:'राम',role:'मजदूर',daily_rate:500}],attendance:[{id:aid,user_id:uid,worker_id:wid,date:'2026-11-02',advance:100}],worker_expenses:[],cashbook:[{id:cid,user_id:uid,type:'expense',amount:250,payment_id:pid,worker_id:wid}],brick_stock:[],contractors:[],payment_history:[{id:pid,user_id:uid,worker_id:wid,amount:250.75}],material_entries:[{id:'77777777-7777-4777-8777-777777777777',user_id:uid,site_name:'साइट',material_type:'सीमेंट',quantity:2,unit:'बैग',total_amount:650.50}],attendance_logs:[{id:'88888888-8888-4888-8888-888888888888',user_id:uid,worker_id:wid,latitude:26.91,longitude:75.78,photo_url:`${uid}/${wid}/photo.jpg`}],office_locations:[],sites:[]});
const restore = (d: Record<string,unknown>, owner=uid) => db.query('SELECT public.restore_user_data($1::jsonb)', [JSON.stringify({app:'AshapuraSamrat',version:1,user:{id:owner},data:d})]);
beforeAll(async () => {
 db=new PGlite();
 await db.exec(readFileSync('src/test/fixtures/restore-schema.sql','utf8'));
 const file=readdirSync('drizzle/migrations').find(f=>f.endsWith('_atomic_backup_restore.sql'));
 if(!file) throw new Error('Restore migration missing');
 await db.exec(readFileSync(`drizzle/migrations/${file}`,'utf8'));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.exec('SET ROLE authenticated');
},30000);
afterAll(async()=>{await db?.close();});
describe('atomic restore in isolated PostgreSQL',()=>{
 it('restores dependency order, material, GPS, photo reference and exact payment decimals',async()=>{
  await restore(data());
  expect((await db.query<{amount:string}>('SELECT amount FROM payment_history')).rows[0].amount).toBe('250.75');
  expect((await db.query<{latitude:string,photo_url:string}>('SELECT latitude,photo_url FROM attendance_logs')).rows[0]).toEqual({latitude:'26.91',photo_url:`${uid}/${wid}/photo.jpg`});
  expect((await db.query<{total_amount:string}>('SELECT total_amount FROM material_entries')).rows[0].total_amount).toBe('650.50');
  expect((await db.query('SELECT * FROM cashbook WHERE payment_id=$1',[pid])).rows).toHaveLength(1);
 });
 it('repeating a restore does not duplicate records',async()=>{
  await restore(data()); await restore(data());
  for(const t of ['workers','attendance','payment_history','cashbook','attendance_logs','material_entries']) expect((await db.query(`SELECT * FROM ${t}`)).rows).toHaveLength(1);
 });
 it('a late cashbook failure rolls back deleted rows and preceding inserts',async()=>{
  const d=data(); d.workers[0].name='बदला हुआ'; d.cashbook[0].payment_id=aid;
  await expect(restore(d)).rejects.toThrow();
  expect((await db.query<{name:string}>('SELECT name FROM workers')).rows[0].name).toBe('राम');
  expect((await db.query('SELECT * FROM cashbook WHERE payment_id=$1',[pid])).rows).toHaveLength(1);
 });
 it('rejects duplicate IDs without deleting current records',async()=>{
  const d=data(); d.attendance.push({...d.attendance[0]});
  await expect(restore(d)).rejects.toThrow();
  expect((await db.query('SELECT * FROM attendance')).rows).toHaveLength(1);
 });
 it('rejects another backup owner and forged row ownership',async()=>{
  await expect(restore(data(),other)).rejects.toThrow();
  const d=data();d.workers[0].user_id=other;
  await expect(restore(d)).rejects.toThrow();
  expect((await db.query('SELECT * FROM workers')).rows).toHaveLength(1);
 });
 it('rejects incomplete old backups rather than cascading away punch logs',async()=>{
  const d:Record<string,unknown>=data(); delete d.attendance_logs;
  await expect(restore(d)).rejects.toThrow();
  expect((await db.query('SELECT * FROM attendance_logs')).rows).toHaveLength(1);
 });
 it('does not restore account links supplied in a file',async()=>{
  const d=data(); const rows=d.workers as Array<Record<string,unknown>>;rows[0].linked_user_id=other;
  await expect(restore(d)).rejects.toThrow();
  expect((await db.query<{linked_user_id:null}>('SELECT linked_user_id FROM workers')).rows[0].linked_user_id).toBeNull();
 });
 it('valid empty arrays safely clear only the owner snapshot tables',async()=>{
  const d=Object.fromEntries(Object.keys(data()).map(k=>[k,[]]));await restore(d);
  for(const t of ['workers','attendance','payment_history','cashbook','attendance_logs','material_entries']) expect((await db.query(`SELECT * FROM ${t}`)).rows).toHaveLength(0);
 });
});
