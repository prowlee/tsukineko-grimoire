/**
 * 論文タイトル・概要・タグから A〜F のテーマを推定する。
 *
 * A – Foundations  (survey / taxonomy / 全体整理)
 * B – Retrieval & RAG  (retrieval / reranking / chunking / memory / citation grounding)
 * C – Agentic / Deep Research  (multi-step search / planning / tool use / long-horizon)
 * D – Evaluation  (benchmarks / challenge reports / evaluation frameworks / failure analysis)
 * E – Trust & Safety  (robustness / faithfulness / attack-defense / enterprise safety)
 * F – Build & Operate  (production RAG / cost-latency / indexing / workflow)
 *
 * 優先順位: A → C → E → D → F → B
 * 何もマッチしない場合は '' を返す（未分類として残し、精度向上を優先する）
 */

export type Theme = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

interface ThemeRule {
  theme: Theme;
  patterns: RegExp[];
}

const THEME_RULES: ThemeRule[] = [
  // ── A: Foundations（survey / taxonomy / 全体整理）────────────────
  // 最優先: survey 論文は分野横断的なので先に確定させる
  {
    theme: 'A',
    patterns: [
      /\ba\s+survey\s+(of|on|for)\b/i,
      /\bsurvey\s+(of|on)\b/i,
      /\ba\s+review\s+(of|on)\b/i,
      /\bsystematic\s+review\b/i,
      /\bliterature\s+review\b/i,
      /\bwe\s+(survey|present\s+a\s+survey|provide\s+a\s+survey)\b/i,
      /\btaxonomy\s+of\b/i,
      /\boverview\s+(of|on)\b/i,
      /\bcomprehensive\s+(overview|survey|review)\b/i,
      /\btutorial\b/i,
      /\bposition\s+paper\b/i,
      /\blandscape\s+(of|for)\b/i,
      /\bstate.?of.?the.?art\b.*\b(survey|review|overview)\b/i,
    ],
  },

  // ── C: Agentic / Deep Research ────────────────────────────────────
  // planning 単独は汎用語のため、必ず agent/search/autonomous と組み合わせる
  {
    theme: 'C',
    patterns: [
      /\bagentic\b/i,
      /\bllm.?agent\b/i,
      /\bai.?agent\b/i,
      /\blanguage.?agent\b/i,
      /\bweb.?search.*(agent|llm|model)\b/i,
      /\bsearch.?agent\b/i,
      /\bresearch.?agent\b/i,
      /\bdeep.?research\b/i,
      /\biterative.?(retrieval|search|reasoning)\b/i,
      /\bmulti.?step.?(search|retrieval|planning|reasoning)\b/i,
      /\blong.?horizon.*(task|reasoning|plan)\b/i,
      /\bsearch.?loop\b/i,
      /\breact.*(prompting|framework|agent)\b/i,
      /\btool.?augmented.*(llm|model|agent)\b/i,
      /\b(llm|model|ai).?orchestrat/i,
      /\bautonomous.?(agent|research|search|reasoning)\b/i,
      /\bplanning.*(agent|search|autonomous|task)\b/i,
      /\bagent.*(planning|reasoning|tool|search|loop|action)\b/i,
    ],
  },

  // ── F: Build & Operate ────────────────────────────────────────────
  // D（Evaluation）より前に置く。production/infra 論文は必ず benchmark を含むため
  // D に先取りされないよう F を優先評価する。
  {
    theme: 'F',
    patterns: [
      /\bproduction.?(rag|retrieval|system|deploy|pipeline)\b/i,
      /\bdeploy(ment|ing)?.*(rag|llm|retrieval|model|system)\b/i,
      /\b(rag|llm|retrieval|model).*deploy/i,
      /\bserving.*(llm|model|rag|system)\b/i,
      /\b(llm|model|rag).*serving\b/i,
      /\blatency\b/i,                    // レイテンシは F 固有
      /\bthroughput\b/i,
      /\binference\s+(speed|optim|effic|latency|cost)\b/i,
      /\bcost.?(optim|effic|reduc|aware)\b/i,
      /\bsemantic\s+cach/i,
      /\bkv.?cach\b/i,
      /\bquery\s+optim/i,
      /\bindexing.?(design|strateg|optim|scal|effic)\b/i,
      /\bvector\s+index/i,
      /\bworkflow\b/i,                   // workflow は運用文脈で固有性が高い
      /\benterprise\b/i,                 // enterprise は production 文脈で固有性が高い
      /\binfrastructure\b/i,
      /\bscalab(le|ility)\b/i,
      /\barchitecture.*(rag|retrieval|knowledge|system)\b/i,
      /\b(rag|retrieval).*architecture\b/i,
      /\breal.?world.*(deploy|system|application|rag|retrieval|use)\b/i,
      /\bsystem\s+design\b/i,
      /\bpipeline.*(design|optim|rag|retrieval)\b/i,
      /\b(rag|retrieval).*pipeline\b/i,
      /\bmodel\s+compress/i,
      /\bquantiz(ation|ing)\b/i,
      /\bknowledge\s+distillat/i,
      /\bpruning.*(model|llm|retrieval)\b/i,
      /\btoken\s+(compress|reduc|budget)\b/i,
      /\befficienc.*(retrieval|search|rag|inference|index)\b/i,
      /\b(retrieval|search|rag|inference).*efficienc\b/i,
      /\baccelerat.*(retrieval|search|inference)\b/i,
      /\bspeed.?up.*(retrieval|search|inference|rag)\b/i,
    ],
  },

  // ── E: Trust & Safety ─────────────────────────────────────────────
  {
    theme: 'E',
    patterns: [
      /\bhallucina/i,
      /\bfaithful(ness)?\b/i,
      /\bfactual\s+(accuracy|correct|grounding|consistency)\b/i,
      /\badversarial\b/i,
      /\battack.*(llm|rag|prompt|model|retrieval)\b/i,
      /\b(llm|rag|model|retrieval).*\battack\b/i,
      /\bdefens(e|ive).*(attack|adversar|inject)\b/i,
      /\bjailbreak\b/i,
      /\bprompt.?inject/i,
      /\btrustworthi/i,
      /\bai\s+safety\b/i,
      /\bllm\s+safety\b/i,
      /\bsafe\s+(alignment|generation|response|output)\b/i,
      /\bfact.?check/i,
      /\bmisinformation\b/i,
      /\bcitation\s+grounding\b/i,
      /\brobust.*(retrieval|rag|generation|qa)\b/i,
    ],
  },

  // ── D: Evaluation ─────────────────────────────────────────────────
  {
    theme: 'D',
    patterns: [
      /\bbenchmark(ing|s)?\b/i,
      /\bleaderboard\b/i,
      /\bchallenge\s+report\b/i,
      /\bfailure\s+analy/i,
      /\berror\s+analy/i,
      /\bQA\s+dataset\b/i,
      /\bevaluation\s+framework\b/i,
      /\b(automatic|human)\s+evaluat/i,
      /\bevaluat(ion|ing)\s+(of|for)\s+(rag|retrieval|llm|generation|language)\b/i,
      /\b(rag|retrieval|llm|generation)\s+evaluat/i,
      /\btest\s+suite\b/i,
      /\bchallenge\s+set\b/i,
      /\bannotat(ion|ing).*(dataset|corpus|label)\b/i,
    ],
  },

  // ── B: Retrieval & RAG（最後のキャッチオール）─────────────────────
  // 広くとる。B にマッチしなかった場合は fallback で 'B' が返る
  {
    theme: 'B',
    patterns: [
      /\bretrieval.?augmented\b/i,
      /\brag\b/i,
      /\bdense\s+retrieval\b/i,
      /\bpassage\s+(retrieval|ranking)\b/i,
      /\bdocument\s+(retrieval|ranking)\b/i,
      /\binformation\s+retrieval\b/i,
      /\bneural\s+(ranking|retrieval|search|ir)\b/i,
      /\bopen.?domain\s+(qa|question|retrieval)\b/i,
      /\bknowledge.?intensive\b/i,
      /\bknowledge.?retrieval\b/i,
      /\bknowledge.?graph.*(retrieval|qa|search)\b/i,
      /\bgraph\s+rag\b/i,
      /\bmulti.?hop\s+(retrieval|qa|reasoning)\b/i,
      /\bhypothetical\s+(document|embedding|query)\b/i,
      /\brerank(ing|er)?\b/i,
      /\bchunk(ing|ed)?\b/i,
      /\bembedding\b/i,                                      // 再び広く
      /\bvector\s+(store|database|search|index)\b/i,
      /\bapproximat.?nearest.?neighbor\b/i,
      /\bann\b.*\bsearch\b/i,
      /\bsparse\s+retrieval\b/i,
      /\bbm25\b/i,
      /\bhybrid\s+search\b/i,
      /\blong.?context\b/i,                                  // 再び広く
      /\bquery\s+(rewrite|expansion|reformulat)\b/i,
      /\bsemantic\s+search\b/i,
      /\bcontextual\s+(retrieval|compression|embedding)\b/i,
      /\bgrounded\s+generation\b/i,
      /\bmemory.*(retrieval|augment|network)\b/i,
      /\bcross.?encoder\b/i,
      /\bbi.?encoder\b/i,
      /\breading\s+comprehension\b/i,
      /\bquestion\s+answering\b/i,
      /\bin.?context\s+retrieval\b/i,
      /\btext\s+retrieval\b/i,
      /\bcontext\s+(window|length)\b/i,
    ],
  },
];

/**
 * タイトル・概要・タグから最も適したテーマを返す。
 * 複数マッチする場合は THEME_RULES の先頭（優先度高）が採用される。
 * 何もマッチしなければ '' を返す（未分類として残し、誤分類を防ぐ）。
 */
export function classifyTheme(
  title: string,
  summary: string,
  tags: string[]
): Theme | '' {
  const haystack = [title, summary.slice(0, 600), tags.join(' ')].join(' ');

  for (const rule of THEME_RULES) {
    if (rule.patterns.some(p => p.test(haystack))) {
      return rule.theme;
    }
  }
  return '';
}
