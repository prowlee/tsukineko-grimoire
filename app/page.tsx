import Link from 'next/link';

const FEATURES = [
  {
    icon: '🔮',
    label: 'RAGチャット',
    desc: 'インデックスした論文にAIで質問',
  },
  {
    icon: '📚',
    label: '論文書庫',
    desc: '蓄積した論文を一覧・検索',
  },
  {
    icon: '🛰️',
    label: '論文収集',
    desc: '最新論文を自動でインデックス',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0a0a0a]">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-700/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-yellow-600/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center max-w-2xl px-6">

        {/* マスコット画像 */}
        <div className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tsukineko-mascot.png"
            alt="月ねこグリモワール マスコット"
            className="w-[200px] h-[200px] object-contain rounded-2xl
              shadow-[0_0_48px_rgba(167,139,250,0.45)]
              border border-purple-500/20
              bg-white/5"
          />
        </div>

        {/* タイトル */}
        <h1 className="text-5xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-yellow-400">
          Tsukineko Grimoire
        </h1>
        {/* 月ねこグリモワール（装飾ライン付き） */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px w-10 bg-gradient-to-r from-transparent to-purple-400/45" />
          <p className="text-purple-300/60 text-xs tracking-[0.25em]">月ねこグリモワール</p>
          <div className="h-px w-10 bg-gradient-to-l from-transparent to-purple-400/45" />
        </div>

        {/* タイトル・サブタイトル */}
        <p className="text-white/80 font-semibold text-sm leading-relaxed mb-1.5">
          最新研究を追いたい人にも、論文にこれから触れてみたい人にも
        </p>
        <p className="text-purple-200/45 text-xs leading-relaxed mb-9">
          AIとの対話で要点をつかみ、理解を深め、自分の知識として蓄積していくパーソナル論文グリモア
        </p>

        {/* 機能カード（横3列・遷移なし） */}
        <div className="grid grid-cols-3 gap-3 mb-9">
          {FEATURES.map(f => (
            <div
              key={f.label}
              className="bg-black/60 backdrop-blur-xl border border-purple-500/20
                rounded-xl px-3 py-4 text-center"
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-purple-100/85 font-semibold text-xs mb-1.5 whitespace-nowrap">{f.label}</p>
              <p className="text-purple-300/40 text-[10px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ログインボタン */}
        <Link
          href="/login"
          className="bg-purple-700 hover:bg-purple-600 text-white font-semibold px-8 py-3 text-base rounded-lg inline-block
            hover:shadow-[0_0_20px_rgba(167,139,250,0.6)] transition-all duration-300"
        >
          ログインに進む
        </Link>
      </div>
    </main>
  );
}
