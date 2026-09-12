export const RULES = Object.freeze({ rounds: 12, actions: 2, handLimit: 7, loyalty: 40, influence: 6, favor: 50, threshold: 20, institutionCost: 5, institutionLimit: 3 });

export const CARDS = Object.freeze({
  loyalty: { name: '忠诚表态', cost: 2, type: '忠诚', color: 'blue', icon: 'shield', text: '忠诚 +15。结算后忠诚最高（含并列），额外宠幸 +3。', quote: '忠诚必须每天重新提交。' },
  propaganda: { name: '强力宣传', cost: 3, type: '宣传', color: 'red', icon: 'speaker', text: '宠幸 +8，影响力 +2。新增影响力计入本轮峰值。', quote: '报纸上只有一种声音，署名却可以是你。' },
  network: { name: '资源渗透', cost: 0, type: '经营', color: 'green', icon: 'building', text: '影响力 +5。若持有机构，改为影响力 +8。', quote: '每个部门，都有一扇后门。' },
  denounce: { name: '定向举报', cost: 4, type: '阴谋', color: 'purple', icon: 'eye', target: 'rival', text: '目标宠幸 -10。若被挡箭牌拦截，你的宠幸 -4。', quote: '事实尚未查明，结论已经拟好。' },
  levy: { name: '专项摊派', cost: 3, type: '经营', color: 'green', icon: 'coins', target: 'rival', text: '收取目标最多 5 影响力。有完整机构组时改为最多 8。', quote: '这是自愿的。名单已经印好了。' },
  trade: { name: '秘密交易', cost: 2, type: '交易', color: 'gold', icon: 'handshake', target: 'rival', text: '另付目标 3 影响力，随机交换各 1 张剩余手牌；自己宠幸 +5。', quote: '协议只在没有第三个人时有效。' },
  transfer: { name: '人事调动', cost: 7, type: '夺权', color: 'purple', icon: 'building', target: 'institution', text: '接管对手的 1 处机构。最多持有 3 处；可被挡箭牌拦截。', quote: '你只是暂时负责，暂时没有期限。' },
  shield: { name: '挡箭牌', cost: 2, type: '防护', color: 'blue', icon: 'shield', text: '本轮抵挡 1 次举报、夺权、栽赃或一致通过。不能叠加。', quote: '文件上的签字，恰好不是你的。' },
  chorus: { name: '集体颂词', cost: 4, type: '宣传', color: 'red', icon: 'star', text: '自己的宠幸 +12；其他存活官员的宠幸各 +3。', quote: '掌声整齐，领掌的人尤其整齐。' },
  dossier: { name: '机密档案', cost: 2, type: '情报', color: 'gold', icon: 'file', text: '摸 3 张牌。结束行动前需将手牌弃至 7 张。', quote: '保密级别：所有人都知道。' },
  extreme: { name: '极端表忠', cost: 1, type: '险招', color: 'red', icon: 'flame', text: '宠幸 +18。自己下次行动开始时宠幸 -12；终局必须提前偿还。', quote: '掌声太响，也会成为调查线索。' },
  discipline: { name: '纪律整顿', cost: 4, type: '整肃', color: 'purple', icon: 'gavel', text: '其他存活官员忠诚各 -8，自己的忠诚 +5。', quote: '先统一思想，再决定思想是什么。' },
  frame: { name: '栽赃嫁祸', cost: 5, type: '阴谋', color: 'purple', icon: 'file', target: 'rival', text: '目标宠幸 -7、忠诚 -8。可被挡箭牌拦截。', quote: '档案没有说谎，档案只是被整理过。' },
  alibi: { name: '清白证明', cost: 3, type: '自保', color: 'blue', icon: 'seal', text: '自己的宠幸 +7、忠诚 +5。', quote: '清白是一份需要盖章的文件。' },
  unanimous: { name: '一致通过', cost: 4, type: '阴谋', color: 'purple', icon: 'gavel', target: 'rival', text: '目标忠诚低于你时宠幸 -12，否则 -5。可被挡箭牌拦截。', quote: '唯一的反对者没有收到会议通知。' },
  retreat: { name: '暂避锋芒', cost: 0, type: '自保', color: 'blue', icon: 'chair', text: '消耗 4 忠诚，获得 4 宠幸。仍占用 1 次行动。', quote: '有时候，最好的发言是请病假。' },
});

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
