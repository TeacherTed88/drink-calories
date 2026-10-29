/** Canonical drink list — single place to add/remove categories.
 *  IMPORTANT: existing entries (0–22) must never be reordered or removed;
 *  user logs and migration maps reference these indexes. New drinks are
 *  appended at the end. */

export const DRINKS = [
  // ---- core list (indexes 0-22, frozen) ----
  { name: 'Standard beer',               serving: '500 ml',           kcal: 215, color: '--c1' , path: ['china'] , grams: 20 },
  { name: 'Qingdao / Tsingtao 青岛',      serving: '500 ml',           kcal: 195, color: '--c3' , path: ['china'] , grams: 17 },
  { name: 'Tsingtao Draft 青岛纯生',      serving: '500 ml',           kcal: 180, color: '--c3' , path: ['china'] , grams: 16 },
  { name: 'Snow 雪花',                   serving: '500 ml',           kcal: 150, color: '--c2' , path: ['china'] , grams: 13 },
  { name: 'Snow Draft 雪花纯生',          serving: '500 ml',           kcal: 160, color: '--c2' , path: ['china'] , grams: 15 },
  { name: 'Harbin 哈尔滨',               serving: '500 ml',           kcal: 160, color: '--c2' , path: ['china'] , grams: 15 },
  { name: 'Pearl River 珠江',            serving: '500 ml',           kcal: 165, color: '--c3' , path: ['china'] , grams: 14 },
  { name: 'Pearl River Draft 珠江纯生',   serving: '500 ml',           kcal: 175, color: '--c3' , path: ['china'] , grams: 14 },
  { name: 'Budweiser 百威',              serving: '500 ml',           kcal: 195, color: '--c1' , path: ['intl','north-america','usa'] , grams: 14 },
  { name: 'Carlsberg 嘉士伯',            serving: '500 ml',           kcal: 205, color: '--c4' , path: ['intl','europe','denmark'] , grams: 17 },
  { name: 'Heineken 喜力',               serving: '500 ml',           kcal: 220, color: '--c4' , path: ['intl','europe','netherlands'] , grams: 20 },
  { name: 'Tiger 虎牌',                  serving: '500 ml',           kcal: 215, color: '--c4' , path: ['intl','asia','singapore'] , grams: 17 },
  { name: 'San Miguel 生力',             serving: '500 ml',           kcal: 215, color: '--c1' , path: ['intl','asia','philippines'] , grams: 20 },
  { name: 'San Miguel Light 生力清啤',    serving: '500 ml',           kcal: 145, color: '--c1' , path: ['intl','asia','philippines'] , grams: 14 },
  { name: 'Blue Girl 蓝妹',              serving: '500 ml',           kcal: 230, color: '--c2' , path: ['china'] , grams: 18 },
  { name: 'Asahi 朝日',                  serving: '500 ml',           kcal: 220, color: '--c5' , path: ['intl','asia','japan'] , grams: 20 },
  { name: 'Kirin Ichiban 麒麟一番榨',     serving: '500 ml',           kcal: 210, color: '--c5' , path: ['intl','asia','japan'] , grams: 16 },
  { name: 'Guinness Draught 健力士',      serving: '440 ml can',       kcal: 150, color: '--c6' , path: ['intl','europe','ireland'] , grams: 15 },
  { name: 'Carlsberg Smooth Draught',     serving: '500 ml',           kcal: 215, color: '--c4' , path: ['intl','europe','denmark'] , grams: 18 },
  { name: 'Carlsberg Draft 嘉士伯纯生',    serving: '500 ml',           kcal: 200, color: '--c4' , path: ['intl','europe','denmark'] , grams: 17 },
  { name: 'Light beer',                  serving: '500 ml',           kcal: 150, color: '--c4' , path: ['china'] , grams: 14 },
  { name: 'Vodka / whisky',              serving: '1 shot · 45 ml',   kcal: 100, color: '--c5' , path: ['spirits'] , grams: 14 },
  { name: 'Wine',                        serving: '1 glass · 150 ml', kcal: 125, color: '--c6' , path: ['spirits'] , grams: 15 },

  // ---- Meiyijia 美宜佳 shelf additions (appended only) ----
  // Pearl River family
  { name: 'Pearl River 原浆 (unfiltered)', serving: '980 ml can',     kcal: 390, color: '--c3' , path: ['china'] , grams: 35 },
  { name: 'Pearl River 鲜啤特醇',         serving: '500 ml bottle',    kcal: 170, color: '--c3' , path: ['china'] , grams: 13 },
  { name: 'Pearl River 9° Draft bottle',  serving: '528 ml',           kcal: 175, color: '--c3' , path: ['china'] , grams: 15 },
  { name: 'Pearl River 1997 Draft',       serving: '500 ml can',       kcal: 175, color: '--c3' , path: ['china'] , grams: 14 },
  { name: 'Pearl River 12°',              serving: '600 ml bottle',    kcal: 250, color: '--c3' , path: ['china'] , grams: 20 },
  { name: 'Pearl River Classic 老珠江',    serving: '980 ml can',       kcal: 310, color: '--c3' , path: ['china'] , grams: 31 },
  { name: 'Pearl River 330 can',          serving: '330 ml',           kcal: 110, color: '--c3' , path: ['china'] , grams: 9 },
  // Tsingtao variants
  { name: 'Tsingtao Classic 青岛经典',     serving: '600 ml bottle',    kcal: 240, color: '--c1' , path: ['china'] , grams: 20 },
  { name: 'Tsingtao 超爽',                serving: '500 ml can',       kcal: 140, color: '--c1' , path: ['china'] , grams: 12 },
  { name: 'Tsingtao Wheat White 全麦白啤', serving: '500 ml',          kcal: 210, color: '--c1' , path: ['china'] , grams: 16 },
  // Snow & Harbin variants
  { name: 'Snow Brave 勇闯天涯',          serving: '500 ml can',       kcal: 130, color: '--c2' , path: ['china'] , grams: 12 },
  { name: 'Harbin Ice 冰纯',              serving: '600 ml bottle',    kcal: 175, color: '--c2' , path: ['china'] , grams: 15 },
  // Wusu 乌苏 family
  { name: 'Wusu 大乌苏 (red bottle)',     serving: '620 ml',           kcal: 215, color: '--c2' , path: ['china'] , grams: 20 },
  { name: 'Wusu red can 乌苏',            serving: '500 ml',           kcal: 190, color: '--c2' , path: ['china'] , grams: 16 },
  { name: 'Wusu Tianshan 天山原酿',        serving: '500 ml can',       kcal: 175, color: '--c2' , path: ['china'] , grams: 14 },
  { name: 'Wusu Craft 新疆酒花精酿',       serving: '1 L can',          kcal: 400, color: '--c2' , path: ['china'] , grams: 35 },
  // Size variants of beers already in the core list
  { name: 'San Miguel 生力 (640 bottle)', serving: '640 ml bottle',    kcal: 275, color: '--c1' , path: ['intl','asia','philippines'] , grams: 25 },
  { name: 'Blue Girl 蓝妹 (330 bottle)',  serving: '330 ml bottle',    kcal: 150, color: '--c2' , path: ['china'] , grams: 12 },
  { name: 'Heineken 喜力 (330 bottle)',   serving: '330 ml bottle',    kcal: 140, color: '--c4' , path: ['intl','europe','netherlands'] , grams: 13 },
  { name: 'Kirin Ichiban (600 bottle)',   serving: '600 ml bottle',    kcal: 250, color: '--c5' , path: ['intl','asia','japan'] , grams: 19 },
  { name: 'Carlsberg Light 特醇',         serving: '500 ml can',       kcal: 145, color: '--c4' , path: ['intl','europe','denmark'] , grams: 13 },
  // Imports
  { name: '1664 Blanc 凯旋白啤',          serving: '500 ml can',       kcal: 230, color: '--c4' , path: ['intl','europe','france'] , grams: 19 },
  { name: '1664 Rosé 桃红',               serving: '500 ml can',       kcal: 200, color: '--c4' , path: ['intl','europe','france'] , grams: 18 },
  { name: 'Corona 科罗娜',                serving: '355 ml bottle',    kcal: 150, color: '--c6' , path: ['intl','north-america','mexico'] , grams: 13 },
  { name: 'Paulaner 保拉纳小麦',          serving: '500 ml',           kcal: 250, color: '--c5' , path: ['intl','europe','germany'] , grams: 22 },
  { name: 'Franziskaner 教士纯麦',        serving: '500 ml can',       kcal: 230, color: '--c5' , path: ['intl','europe','germany'] , grams: 20 },
  { name: 'Kaiserdom Wheat 凯撒白啤',     serving: '500 ml can',       kcal: 225, color: '--c5' , path: ['intl','europe','germany'] , grams: 19 },
  { name: 'Kaiserdom Dark 凯撒黑啤',      serving: '500 ml can',       kcal: 220, color: '--c5' , path: ['intl','europe','germany'] , grams: 19 },
  { name: 'Würenbacher Wheat 瓦伦丁小麦', serving: '500 ml can',       kcal: 240, color: '--c5' , path: ['intl','europe','germany'] , grams: 21 },
  { name: 'Würenbacher Dark 瓦伦丁黑啤',  serving: '500 ml can',       kcal: 225, color: '--c5' , path: ['intl','europe','germany'] , grams: 19 },
  { name: 'Eichbaum 爱士堡小麦',          serving: '500 ml can',       kcal: 240, color: '--c5' , path: ['intl','europe','germany'] , grams: 21 },
  { name: 'Xue Bao 雪堡 Belgian white',   serving: '500 ml',           kcal: 215, color: '--c4' , path: ['china'] , grams: 18 },
  { name: 'XinQishi 鑫骑士 white',        serving: '500 ml can',       kcal: 220, color: '--c4' , path: ['china'] , grams: 19 },
  { name: 'Laoshan 崂山 8°',              serving: '330 ml can',       kcal: 100, color: '--c3' , path: ['china'] , grams: 8 },
  { name: 'Pabst Blue Ribbon 蓝带',       serving: '640 ml bottle',    kcal: 270, color: '--c1' , path: ['intl','north-america','usa'] , grams: 22 },
  // ---- Thailand (Asia) ----
  { name: 'Chang 象牌',                   serving: '620 ml bottle',    kcal: 290, grams: 25, path: ['intl','asia','thailand'] },
  { name: 'Singha 胜狮',                  serving: '630 ml bottle',    kcal: 290, grams: 25, path: ['intl','asia','thailand'] },
  { name: 'Leo 豹王',                     serving: '490 ml can',       kcal: 225, grams: 19, path: ['intl','asia','thailand'] },
  // ---- Canada (Toronto) ----
  { name: 'Molson Canadian',              serving: '355 ml bottle',    kcal: 150, grams: 14, path: ['intl','north-america','canada'] },
  { name: 'Labatt Blue',                  serving: '355 ml bottle',    kcal: 150, grams: 14, path: ['intl','north-america','canada'] },
  { name: 'Steam Whistle',                serving: '473 ml can',       kcal: 200, grams: 19, path: ['intl','north-america','canada'] },
  { name: 'Moosehead',                    serving: '355 ml bottle',    kcal: 150, grams: 14, path: ['intl','north-america','canada'] },
];
