export const RULES = Object.freeze({ rounds: 12, actions: 2, handLimit: 7, loyalty: 40, influence: 6, favor: 50, favorDecay: 5, threshold: 20, institutionCost: 5, institutionLimit: 3 });

export const CARDS = Object.freeze({
  loyalty: { name: '忠诚表态', cost: 2, type: '忠诚', color: 'blue', icon: 'shield', text: '立即获得 15 忠诚。随后若忠诚为存活官员中最高（含并列），立即再得 3 宠幸。', quote: '忠诚必须每天重新提交。' },
  propaganda: { name: '强力宣传', cost: 3, favorGain: 6, influenceRefund: 1, type: '宣传', color: 'red', icon: 'speaker', text: '先支付 3 影响力，立即获得 6 宠幸并返还 1 影响力；净耗 2 影响力。', quote: '报纸上只有一种声音，署名却可以是你。' },
  network: { name: '资源渗透', cost: 0, type: '经营', color: 'green', icon: 'building', text: '立即获得 5 影响力；持有至少一处机构时改为 8。新增权势可能提高本轮猜忌。', quote: '每个部门，都有一扇后门。' },
  denounce: { name: '定向举报', cost: 4, type: '阴谋', color: 'purple', icon: 'eye', target: 'rival', text: '立即使目标宠幸 -10。目标可用挡箭牌拦截；被拦截时，你的宠幸 -4。', quote: '事实尚未查明，结论已经拟好。' },
  levy: { name: '专项摊派', cost: 3, type: '经营', color: 'green', icon: 'coins', target: 'rival', text: '从目标收取最多 5 影响力，自己有完整机构组时最多 8；到账受目标余额与自身上限限制。', quote: '这是自愿的。名单已经印好了。' },
  trade: { name: '秘密交易', cost: 3, gift: 2, selection: 'give', type: '交易', color: 'gold', icon: 'handshake', target: 'rival', text: '合计花费 3 影响力，其中 2 给目标；自己立即 +5 宠幸。选一张其他手牌，交换目标随机一张。', quote: '有些档案的价值，取决于它离你的办公室有多远。' },
  transfer: { name: '人事调动', cost: 7, type: '夺权', color: 'purple', icon: 'building', target: 'institution', text: '接管对手一处机构，下轮开始产生收入；最多持有三处。原负责人可用挡箭牌拦截。', quote: '你只是暂时负责，暂时没有期限。' },
  shield: { name: '挡箭牌', cost: 2, actions: 0, type: '反应', color: 'blue', icon: 'shield', text: '遇到举报、夺权、栽赃或一致通过时，可付费弃置本牌，拦截该次攻击。不占行动，受袭时选择使用。', quote: '文件上的签字，恰好不是你的。' },
  chorus: { name: '集体颂词', cost: 4, favorGain: 10, rivalFavorGain: 1, type: '宣传', color: 'red', icon: 'star', text: '自己立即获得 10 宠幸；其他存活官员各获得 1 宠幸。', quote: '掌声整齐，领掌的人尤其整齐。' },
  dossier: { name: '机密档案', cost: 1, actions: 0, selection: 'discard', type: '情报', color: 'gold', icon: 'file', text: '弃一张其他手牌，再摸两张。不占行动；每次轮到自己限用一次，行动次数用完也可使用。', quote: '保密级别：只保留对你有用的部分。' },
  extreme: { name: '极端表忠', cost: 1, loyaltyCost: 20, type: '险招', color: 'red', icon: 'flame', text: '消耗 20 忠诚，立即获得 18 宠幸。须足额支付；忠诚降低会影响未来收入与忠诚排名。', quote: '我忠于组织，但我更忠于您。' },
  discipline: { name: '纪律整顿', cost: 3, type: '整肃', color: 'purple', icon: 'gavel', text: '其他存活官员立即各失去 8 忠诚，自己获得 5 忠诚。影响后续收入与忠诚排名。', quote: '先统一思想，再决定思想是什么。' },
  frame: { name: '栽赃嫁祸', cost: 5, loyaltyDamage: 15, type: '阴谋', color: 'purple', icon: 'file', target: 'rival', text: '立即使目标宠幸 -7、忠诚 -15。目标可用挡箭牌拦截。', quote: '档案没有说谎，档案只是被整理过。' },
  alibi: { name: '清白证明', cost: 3, type: '自保', color: 'blue', icon: 'seal', text: '自己立即获得 7 宠幸、5 忠诚。宠幸恢复到至少 20 才会解除调查。', quote: '清白是一份需要盖章的文件。' },
  unanimous: { name: '一致通过', cost: 4, type: '阴谋', color: 'purple', icon: 'gavel', target: 'rival', text: '出牌时，目标忠诚低于你：目标宠幸 -12；相同或更高：-5。可被挡箭牌拦截。', quote: '唯一的反对者没有收到会议通知。' },
  retreat: { name: '暂避锋芒', cost: 0, loyaltyCost: 4, type: '自保', color: 'blue', icon: 'chair', text: '消耗 4 忠诚，立即获得 4 宠幸。占用一次行动；不产生防护。', quote: '有时候，最好的发言是请病假。' },
});

export function cardCostText(id) {
  const c = CARDS[id];
  return `${c.cost} 影响力${c.loyaltyCost ? ' + ' + c.loyaltyCost + ' 忠诚' : ''} · ${c.actions === 0 ? '不占行动' : '1 次行动'}`;
}

export const INSTITUTIONS = Object.freeze([
  { id: 'radio', name: '中央广播局', group: '宣传', icon: 'speaker', color: 'red', subtitle: '决定谁的声音更响' },
  { id: 'press', name: '国家报社', group: '宣传', icon: 'file', color: 'red', subtitle: '决定昨天发生过什么' },
  { id: 'cadres', name: '干部任命局', group: '组织', icon: 'seal', color: 'blue', subtitle: '决定谁有资格决定' },
  { id: 'academy', name: '中央党校', group: '组织', icon: 'building', color: 'blue', subtitle: '正确思想的唯一来源' },
  { id: 'supply', name: '军需统筹署', group: '财政', icon: 'coins', color: 'green', subtitle: '忠诚也需要预算' },
  { id: 'ration', name: '特别配给局', group: '财政', icon: 'building', color: 'green', subtitle: '人人平等，配给不同' },
]);

export const EVENTS = Object.freeze([
  { id: 'praise', name: '普遍嘉奖', text: '所有存活官员宠幸 +4。', quote: '元首今天对所有人都很满意。原因尚不明确。', icon: 'star' },
  { id: 'census', name: '忠诚普查', text: '忠诚最低的官员宠幸 -5，含并列。', quote: '统计结果表明，总有人不够忠诚。', icon: 'eye' },
  { id: 'funding', name: '临时拨款', text: '所有存活官员影响力 +3，计入峰值。', quote: '新增预算的用途是说明新增预算的必要性。', icon: 'coins' },
  { id: 'austerity', name: '紧缩通知', text: '所有存活官员影响力 -2。', quote: '请各部门自行克服由各部门造成的困难。', icon: 'file' },
  { id: 'insomnia', name: '元首失眠', text: '所有存活官员宠幸 -4。', quote: '没人知道他梦见了谁。所有人都提前写好了检讨。', icon: 'eye' },
  { id: 'audit', name: '机构审计', text: '每控制 1 处机构，宠幸 -2。', quote: '工作太多，说明你的手伸得太长。', icon: 'building' },
  { id: 'anniversary', name: '纪念大会', text: '所有存活官员忠诚 +8。', quote: '全体起立。请保持起立，直到通知结束。', icon: 'star' },
  { id: 'purge', name: '集体整肃', text: '所有存活官员宠幸 -5，忠诚最低者再 -3。', quote: '经过严格筛选，问题出在尚未被筛选的人身上。', icon: 'gavel' },
]);

export const OFFICIALS = Object.freeze([
  { id: 0, name: '你', title: '特别事务专员', personality: 'balanced', tag: '候选人 01', color: 'gold', initials: '你' },
  { id: 1, name: '维克托', title: '宣传事务部长', personality: 'courtier', tag: '颂词专家', color: 'red', initials: '维' },
  { id: 2, name: '海伦娜', title: '组织事务书记', personality: 'builder', tag: '机构经营者', color: 'blue', initials: '海' },
  { id: 3, name: '奥托', title: '纪律监察专员', personality: 'survivor', tag: '谨慎的同僚', color: 'green', initials: '奥' },
]);
