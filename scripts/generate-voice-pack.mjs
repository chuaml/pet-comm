import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const OUT_DIR = join(process.cwd(), 'public', 'voice-pack');
mkdirSync(OUT_DIR, { recursive: true });

const VOICE_NAME = 'en-US-AvaMultilingualNeural';
const PACK_VERSION = 'ava-warm-v1';

const WORDS = [
  { key: 'outside', text: 'Outside', aliases: ['outside', 'out'] },
  { key: 'eat', text: 'Eat', aliases: ['eat', 'food', 'hungry', 'dinner'] },
  { key: 'water', text: 'Water', aliases: ['water', 'drink', 'thirsty'] },
  { key: 'treat', text: 'Treat', aliases: ['treat', 'snack', 'bone'] },
  { key: 'play', text: 'Play', aliases: ['play', 'toy'] },
  { key: 'ball', text: 'Ball', aliases: ['ball'] },
  { key: 'frisbee', text: 'Frisbee', aliases: ['frisbee', 'disc'] },
  { key: 'come', text: 'Come', aliases: ['come', 'here', 'come here'] },
  { key: 'sit', text: 'Sit', aliases: ['sit'] },
  { key: 'stay', text: 'Stay', aliases: ['stay', 'wait'] },
  { key: 'up', text: 'Up', aliases: ['up'] },
  { key: 'down', text: 'Down', aliases: ['down'] },
  { key: 'okay', text: 'Okay', aliases: ['okay', 'ok'] },
  { key: 'no', text: 'No', aliases: ['no', 'stop'] },
  { key: 'walk', text: 'Walk', aliases: ['walk', 'leash'] },
  { key: 'potty', text: 'Potty', aliases: ['potty'] },
  { key: 'good', text: 'Good', aliases: ['good', 'good job'] },
  { key: 'yes', text: 'Yes', aliases: ['yes', 'yeah'] },
  { key: 'all-done', text: 'All done', aliases: ['all done', 'done'] },
  { key: 'love', text: 'Love', aliases: ['love', 'love you', 'cuddle', 'pet'] },
];

async function synthesizeClip(item) {
  const outPath = join(OUT_DIR, `${item.key}.mp3`);
  if (existsSync(outPath) && statSync(outPath).size >= 1000) {
    return {
      key: item.key,
      text: item.text,
      aliases: item.aliases,
      url: `/voice-pack/${item.key}.mp3`,
      mimeType: 'audio/mpeg',
      bytes: statSync(outPath).size,
    };
  }

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
      await execFileAsync('uvx', [
        'edge-tts',
        '--voice',
        VOICE_NAME,
        '--rate=-6%',
        '--pitch=+4Hz',
        '--text',
        `${item.text}.`,
        '--write-media',
        outPath,
      ]);
      const stats = statSync(outPath);
      if (stats.size >= 1000) {
        return {
          key: item.key,
          text: item.text,
          aliases: item.aliases,
          url: `/voice-pack/${item.key}.mp3`,
          mimeType: 'audio/mpeg',
          bytes: stats.size,
        };
      }
      unlinkSync(outPath);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Failed to synthesize ${item.key}`);
}

const clips = [];
let totalBytes = 0;

for (const item of WORDS) {
  const meta = await synthesizeClip(item);
  clips.push(meta);
  totalBytes += meta.bytes;
  console.log(`Generated ${meta.key}.mp3 (${meta.bytes} bytes)`);
}

const manifest = {
  version: PACK_VERSION,
  voiceLabel: 'Ava — Warm Natural Human Voice',
  totalBytes,
  clips,
};

writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote manifest.json (${clips.length} clips, ${(totalBytes / 1024).toFixed(1)} KB total)`);
