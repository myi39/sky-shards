/* global luxon */
const { Duration, DateTime } = luxon;

const LAND_OFFSET = Duration.fromObject({ minutes: 8, seconds: 40 });
const END_OFFSET  = Duration.fromObject({ hours: 4 });

const SHARD_CONFIGS = [
  {
    noShardWkDay: [6, 7],
    interval: Duration.fromObject({ hours: 8 }),
    offset:   Duration.fromObject({ hours: 1, minutes: 50 }),
    maps: ['prairie.butterfly', 'forest.brook', 'valley.rink', 'wasteland.temple', 'vault.starlight'],
  },
  {
    noShardWkDay: [7, 1],
    interval: Duration.fromObject({ hours: 8 }),
    offset:   Duration.fromObject({ hours: 2, minutes: 10 }),
    maps: ['prairie.village', 'forest.boneyard', 'valley.rink', 'wasteland.battlefield', 'vault.starlight'],
  },
  {
    noShardWkDay: [1, 2],
    interval: Duration.fromObject({ hours: 6 }),
    offset:   Duration.fromObject({ hours: 7, minutes: 40 }),
    maps: ['prairie.cave', 'forest.end', 'valley.dreams', 'wasteland.graveyard', 'vault.jelly'],
  },
  {
    noShardWkDay: [2, 3],
    interval: Duration.fromObject({ hours: 6 }),
    offset:   Duration.fromObject({ hours: 2, minutes: 20 }),
    maps: ['prairie.bird', 'forest.tree', 'valley.dreams', 'wasteland.crab', 'vault.jelly'],
  },
  {
    noShardWkDay: [3, 4],
    interval: Duration.fromObject({ hours: 6 }),
    offset:   Duration.fromObject({ hours: 3, minutes: 30 }),
    maps: ['prairie.island', 'forest.sunny', 'valley.hermit', 'wasteland.ark', 'vault.jelly'],
  },
];

const MAP_NAMES = {
  'prairie.butterfly': '蝶々の住処',
  'prairie.village':   '村',
  'prairie.cave':      '洞窟',
  'prairie.bird':      '鳥の巣',
  'prairie.island':    '楽園の島々',
  'forest.brook':      '小川',
  'forest.boneyard':   '墓場',
  'forest.end':        '雨林の端',
  'forest.tree':       'ツリーハウス',
  'forest.sunny':      '高台広場',
  'valley.rink':       'アイスリンク',
  'valley.dreams':     '夢見の町',
  'valley.hermit':     '隠者の峠',
  'wasteland.temple':  '倒壊した祠',
  'wasteland.battlefield': '戦場',
  'wasteland.graveyard':   '墓所',
  'wasteland.crab':    '蟹の沼地（座礁船）',
  'wasteland.ark':     '忘れられた方舟',
  'vault.starlight':   '星月夜の砂漠',
  'vault.jelly':       '海月の入り江',
};

const REALMS   = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
const REALM_JA = { prairie: '草原', forest: '雨林', valley: '峡谷', wasteland: '捨て地', vault: '書庫' };

// 黒シャード：光のかけら 200粒（大キャンドル4つ分 = 大キャン×4）
const BLACK_SHARD_REWARD_FRAGMENTS = 200;

// 赤シャードのみ。マップごとに決まる1日の星キャン上限数（星キャン）。
const REWARD_AC = {
  'prairie.cave':        2,
  'prairie.bird':        2.5,
  'prairie.island':      3.5,
  'forest.end':          2.5,
  'forest.tree':         3.5,
  'forest.sunny':        3.5,
  'valley.dreams':       2.5,
  'valley.hermit':       3.5,
  'wasteland.graveyard': 2,
  'wasteland.crab':      2.5,
  'wasteland.ark':       3.5,
  'vault.jelly':         3.5,
};

// date: luxon DateTime（任意のゾーン可）
function getShardInfo(date) {
  const today   = date.setZone('America/Los_Angeles').startOf('day');
  const dayOfMth = today.day;
  const dayOfWk  = today.weekday; // 1=Mon … 7=Sun

  const isRed    = dayOfMth % 2 === 1;
  const realmIdx = (dayOfMth - 1) % 5;
  const infoIndex = isRed
    ? (Math.floor((dayOfMth - 1) / 2) % 3) + 2
    : Math.floor(dayOfMth / 2) % 2;

  const config   = SHARD_CONFIGS[infoIndex];
  const hasShard = !config.noShardWkDay.includes(dayOfWk);
  const mapKey   = config.maps[realmIdx];

  // DST補正: 日曜かつ、日付跨ぎで夏時間が変わる場合にオフセットを1h調整
  let firstStart = today.plus(config.offset);
  if (dayOfWk === 7 && today.isInDST !== firstStart.isInDST) {
    firstStart = firstStart.plus({ hours: firstStart.isInDST ? -1 : 1 });
  }

  const occurrences = Array.from({ length: 3 }, (_, i) => {
    const start = firstStart.plus(config.interval.mapUnits(x => x * i));
    const land  = start.plus(LAND_OFFSET);
    const end   = start.plus(END_OFFSET);
    return { start, land, end, startLocal: start.toLocal(), landLocal: land.toLocal(), endLocal: end.toLocal() };
  });

  return {
    date:     today,
    isRed,
    hasShard,
    realm:    REALMS[realmIdx],
    realmJa:  REALM_JA[REALMS[realmIdx]],
    mapKey,
    location: MAP_NAMES[mapKey],
    occurrences,
    lastEnd:  occurrences[2].end,
    rewardAC:        isRed ? REWARD_AC[mapKey] : null,
    rewardFragments: isRed ? null : BLACK_SHARD_REWARD_FRAGMENTS,
  };
}

// from: luxon DateTime（Sky ゾーン推奨）
// 再帰でシャードのある日を探す（深さは最大 2 日程度）
function findNextShard(from) {
  const info = getShardInfo(from);
  if (info.hasShard && from < info.lastEnd) {
    return info;
  }
  return findNextShard(info.date.plus({ days: 1 }));
}
