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
  'prairie.butterfly': 'Butterfly Field',
  'prairie.village':   'Village Islands',
  'prairie.cave':      'Cave',
  'prairie.bird':      'Bird Nest',
  'prairie.island':    'Sanctuary Island',
  'forest.brook':      'Forest Brook',
  'forest.boneyard':   'Boneyard',
  'forest.end':        'Forest Garden',
  'forest.tree':       'Treehouse',
  'forest.sunny':      'Elevated Clearing',
  'valley.rink':       'Ice Rink',
  'valley.dreams':     'Village of Dreams',
  'valley.hermit':     'Hermit Valley',
  'wasteland.temple':  'Broken Temple',
  'wasteland.battlefield': 'Battlefield',
  'wasteland.graveyard':   'Graveyard',
  'wasteland.crab':    'Crabfield',
  'wasteland.ark':     'Forgotten Ark',
  'vault.starlight':   'Starlight Desert',
  'vault.jelly':       'Jellyfish Cove',
};

const REALMS   = ['prairie', 'forest', 'valley', 'wasteland', 'vault'];
const REALM_JA = { prairie: '草原', forest: '森', valley: '谷', wasteland: '荒れ地', vault: '金庫' };

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
