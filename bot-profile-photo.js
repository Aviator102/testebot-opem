const nmv = require('@caspertech/node-metaverse');

let InstantMessageDialog;
try {
  InstantMessageDialog = require('@caspertech/node-metaverse/dist/lib/enums/InstantMessageDialog.js').InstantMessageDialog;
} catch (_) {
  InstantMessageDialog = {};
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function makeLoginParameters() {
  const p = new nmv.LoginParameters();
  p.firstName = env('BOT_FIRST_NAME');
  p.lastName = env('BOT_LAST_NAME');
  p.password = env('BOT_PASSWORD');
  p.start = env('START', 'last');

  // Algumas versões do node-metaverse aceitam loginURI, outras loginURL.
  const loginURI = env('LOGIN_URI', 'http://www.alifevirtual.com:8002/');
  p.loginURI = loginURI;
  p.loginURL = loginURI;
  p.gridURL = loginURI;
  return p;
}

function getCandidateImageUUID(obj) {
  if (!obj || typeof obj !== 'object') return null;

  const directNames = [
    'imageID', 'ImageID', 'profileImage', 'profileImageID', 'ProfileImage',
    'ProfileImageID', 'profilePicture', 'profilePictureID', 'ProfilePicture',
    'ProfilePictureID', 'flImageID', 'FLImageID', 'snapshotID', 'SnapshotID',
    'profile_image', 'profile_image_id', 'image_id', 'picture', 'pictureID'
  ];

  for (const name of directNames) {
    const v = obj[name];
    if (v && UUID_RE.test(String(v))) return String(v);
    if (v && typeof v === 'object') {
      const s = v.toString && v.toString();
      if (s && UUID_RE.test(s)) return s;
    }
  }

  // Busca recursiva pequena para achar algum campo com nome de imagem/foto.
  const seen = new Set();
  function scan(x, depth = 0) {
    if (!x || typeof x !== 'object' || depth > 4 || seen.has(x)) return null;
    seen.add(x);
    for (const [k, v] of Object.entries(x)) {
      const key = String(k).toLowerCase();
      const looksPhoto = key.includes('image') || key.includes('picture') || key.includes('snapshot') || key.includes('photo');
      if (looksPhoto) {
        const s = (v && typeof v === 'object' && v.toString) ? v.toString() : String(v || '');
        if (UUID_RE.test(s)) return s;
      }
      if (v && typeof v === 'object') {
        const found = scan(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return scan(obj);
}

async function callIfExists(root, paths, avatarUUID) {
  for (const path of paths) {
    let ctx = root;
    let fn = root;
    const parts = path.split('.');
    for (const part of parts) {
      ctx = fn;
      fn = fn && fn[part];
    }
    if (typeof fn === 'function') {
      console.log('[TESTE] Tentando:', path);
      const result = await fn.call(ctx, new nmv.UUID(avatarUUID));
      const img = getCandidateImageUUID(result);
      if (img) return { photo: img, source: path, raw: result };
      console.log('[TESTE] Resposta sem campo de foto em:', path, safeJson(result));
    }
  }
  return null;
}

function safeJson(v) {
  try { return JSON.stringify(v, null, 2).slice(0, 2000); } catch (_) { return String(v); }
}

function listAvailableMethods(bot) {
  const out = [];
  const bases = [
    ['clientCommands.avatar', bot.clientCommands && bot.clientCommands.avatar],
    ['clientCommands.agent', bot.clientCommands && bot.clientCommands.agent],
    ['clientCommands.appearance', bot.clientCommands && bot.clientCommands.appearance],
    ['clientCommands', bot.clientCommands],
    ['clientEvents', bot.clientEvents],
    ['client', bot.client]
  ];
  for (const [name, obj] of bases) {
    if (!obj) continue;
    const methods = [];
    let cur = obj;
    for (let level = 0; cur && level < 3; level++) {
      for (const k of Object.getOwnPropertyNames(cur)) {
        if (typeof obj[k] === 'function' || typeof cur[k] === 'function') methods.push(k);
      }
      cur = Object.getPrototypeOf(cur);
    }
    out.push(`${name}: ${[...new Set(methods)].sort().join(', ')}`);
  }
  return out.join('\n').slice(0, 3500);
}

async function getProfilePhoto(bot, avatarUUID) {
  const paths = [
    'clientCommands.avatar.getAvatarProperties',
    'clientCommands.avatar.requestAvatarProperties',
    'clientCommands.avatar.getProfile',
    'clientCommands.avatar.getAvatarProfile',
    'clientCommands.agent.getAvatarProperties',
    'clientCommands.agent.requestAvatarProperties',
    'clientCommands.profile.getAvatarProperties',
    'clientCommands.profile.getProfile',
    'clientCommands.appearance.getAvatarProperties'
  ];

  const direct = await callIfExists(bot, paths, avatarUUID);
  if (direct) return direct;

  throw new Error('Esta versão do @caspertech/node-metaverse não expôs uma função pronta de perfil. Envie o comando !methods para ver os métodos disponíveis no log.');
}

async function main() {
  const required = ['BOT_FIRST_NAME', 'BOT_LAST_NAME', 'BOT_PASSWORD'];
  for (const r of required) {
    if (!process.env[r]) throw new Error(`Falta variável ${r}`);
  }

  const loginParameters = makeLoginParameters();
  const options = nmv.BotOptionFlags.LiteObjectStore | nmv.BotOptionFlags.StoreMyAttachmentsOnly;
  const bot = new nmv.Bot(loginParameters, options);
  let botUUID = null;

  console.log('Logando em:', process.env.LOGIN_URI || 'http://www.alifevirtual.com:8002/');
  const login = await bot.login();
  botUUID = login && login.agentID ? login.agentID.toString() : null;
  console.log('Login completo. Bot UUID:', botUUID || 'desconhecido');
  await bot.connectToSim();
  console.log('Conectado. Envie IM para o bot com a UUID do avatar.');

  bot.clientEvents.onInstantMessage.subscribe(async (e) => {
    try {
      if (botUUID && e.from && e.from.toString() === botUUID) return;
      if (e.dialog === InstantMessageDialog.GroupInvitation) return;

      const msg = String(e.message || '').trim();
      const lower = msg.toLowerCase();
      console.log(`[IM] ${e.fromName}: ${msg}`);

      if (lower === 'help' || lower === '!help' || lower === 'ajuda') {
        await bot.clientCommands.comms.sendInstantMessage(e.from,
          'Envie apenas a UUID do avatar. Exemplo: ebfa3892-5c02-4468-82c8-2788bf904729'
        );
        return;
      }

      if (lower === '!methods') {
        const methods = listAvailableMethods(bot);
        console.log(methods);
        await bot.clientCommands.comms.sendInstantMessage(e.from, 'Métodos impressos no log do servidor.');
        return;
      }

      const match = msg.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (!match) {
        await bot.clientCommands.comms.sendInstantMessage(e.from, 'Mande uma UUID válida de avatar.');
        return;
      }

      const avatarUUID = match[0];
      await bot.clientCommands.comms.sendInstantMessage(e.from, `Buscando foto do perfil de ${avatarUUID}...`);

      const result = await getProfilePhoto(bot, avatarUUID);
      await bot.clientCommands.comms.sendInstantMessage(e.from,
        `UUID da foto do perfil:\n${result.photo}\nFonte: ${result.source}`
      );
    } catch (err) {
      console.error('[ERRO IM]', err);
      try {
        await bot.clientCommands.comms.sendInstantMessage(e.from, 'Erro: ' + (err.message || err));
      } catch (_) {}
    }
  });
}

main().catch((err) => {
  console.error('Erro ao iniciar:', err.message || err);
  process.exit(1);
});
