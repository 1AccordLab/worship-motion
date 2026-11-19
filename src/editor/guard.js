let suspects = [], lastProbe = null;
const saveSuspects = () => shared.set('suspect', JSON.stringify(suspects.slice(-SUSPECT_MAX)));
// 試跑前先留標記、試跑完才清：下次打開還看得到標記，就表示上次試跑時頁面當掉了
function loadGuard() {
  try { suspects = JSON.parse(shared.get('suspect') || '[]'); } catch (e) { }
  try { lastProbe = JSON.parse(shared.get('probe')); } catch (e) { }
  if (lastProbe) { if (!suspects.includes(lastProbe.hash)) suspects.push(lastProbe.hash); saveSuspects(); shared.set('probe', null); }
}
const markProbe = (kind, hash, name) => shared.set('probe', JSON.stringify({ kind, hash, name }));
const clearProbe = () => shared.set('probe', null);
const suspect = h => suspects.includes(h);
const addSuspect = h => { if (!suspect(h)) { suspects.push(h); saveSuspects(); } };
const unSuspect = h => { suspects = suspects.filter(x => x !== h); saveSuspects(); };
const clearSuspects = () => { suspects = []; saveSuspects(); };
