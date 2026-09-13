import { RegionBlock } from '../types';

/**
 * Simple 8-block regional classification (地方ブロック分類) used as the basis
 * for the region-proximity table. This intentionally avoids anything more
 * elaborate (e.g. real distance/geo APIs) per the "自作" requirement.
 */
export const PREFECTURE_TO_BLOCK: Record<string, RegionBlock> = {
  北海道: 'hokkaido',
  青森県: 'tohoku',
  岩手県: 'tohoku',
  宮城県: 'tohoku',
  秋田県: 'tohoku',
  山形県: 'tohoku',
  福島県: 'tohoku',
  茨城県: 'kanto',
  栃木県: 'kanto',
  群馬県: 'kanto',
  埼玉県: 'kanto',
  千葉県: 'kanto',
  東京都: 'kanto',
  神奈川県: 'kanto',
  新潟県: 'chubu',
  富山県: 'chubu',
  石川県: 'chubu',
  福井県: 'chubu',
  山梨県: 'chubu',
  長野県: 'chubu',
  岐阜県: 'chubu',
  静岡県: 'chubu',
  愛知県: 'chubu',
  三重県: 'kinki',
  滋賀県: 'kinki',
  京都府: 'kinki',
  大阪府: 'kinki',
  兵庫県: 'kinki',
  奈良県: 'kinki',
  和歌山県: 'kinki',
  鳥取県: 'chugoku',
  島根県: 'chugoku',
  岡山県: 'chugoku',
  広島県: 'chugoku',
  山口県: 'chugoku',
  徳島県: 'shikoku',
  香川県: 'shikoku',
  愛媛県: 'shikoku',
  高知県: 'shikoku',
  福岡県: 'kyushu_okinawa',
  佐賀県: 'kyushu_okinawa',
  長崎県: 'kyushu_okinawa',
  熊本県: 'kyushu_okinawa',
  大分県: 'kyushu_okinawa',
  宮崎県: 'kyushu_okinawa',
  鹿児島県: 'kyushu_okinawa',
  沖縄県: 'kyushu_okinawa',
};

/** Blocks that are geographically adjacent to each other (undirected). */
const ADJACENT_BLOCKS: Partial<Record<RegionBlock, RegionBlock[]>> = {
  hokkaido: ['tohoku'],
  tohoku: ['hokkaido', 'kanto'],
  kanto: ['tohoku', 'chubu'],
  chubu: ['kanto', 'kinki'],
  kinki: ['chubu', 'chugoku', 'shikoku'],
  chugoku: ['kinki', 'shikoku', 'kyushu_okinawa'],
  shikoku: ['kinki', 'chugoku'],
  kyushu_okinawa: ['chugoku'],
};

export function blockOf(prefecture: string): RegionBlock | undefined {
  return PREFECTURE_TO_BLOCK[prefecture];
}

/**
 * Raw proximity between two prefectures, 0-1, ignoring relocation intent:
 * same prefecture = 1, same block = 0.7, adjacent block = 0.4, otherwise 0.2.
 */
export function prefectureProximity(prefA: string, prefB: string): number {
  if (prefA === prefB) return 1;
  const blockA = blockOf(prefA);
  const blockB = blockOf(prefB);
  if (!blockA || !blockB) return 0.2;
  if (blockA === blockB) return 0.7;
  if (ADJACENT_BLOCKS[blockA]?.includes(blockB)) return 0.4;
  return 0.2;
}

export interface RegionScoreInput {
  talentPrefecture: string;
  companyPrefecture: string;
  relocatable: boolean;
  workStyle: 'remote' | 'onsite' | 'both';
}

/**
 * Region match score (0-1) combining raw prefecture proximity with the
 * talent's relocation flag and work style:
 *  - Fully remote work makes geography irrelevant -> full score.
 *  - A talent willing to relocate has the location gap effectively closed,
 *    but not entirely (some friction/uncertainty remains), so proximity is
 *    blended up towards 1.
 *  - Otherwise the raw prefecture/block proximity applies as-is.
 */
export function computeRegionScore(input: RegionScoreInput): number {
  const { talentPrefecture, companyPrefecture, relocatable, workStyle } = input;
  if (workStyle === 'remote') return 1;

  const proximity = prefectureProximity(talentPrefecture, companyPrefecture);
  if (relocatable) {
    return proximity + (1 - proximity) * 0.7;
  }
  return proximity;
}
