import OnChainStatsAndCases from "@/components/OnChainStatsAndCases";
import DisputeIntelligenceWorkspace from "@/components/DisputeIntelligenceWorkspace";
import FujiTransactionVerifier from "@/components/FujiTransactionVerifier";

const stats = [
  { label: "Total Disputes", value: "24", note: "Cases registered" },
  { label: "Under Investigation", value: "08", note: "AI analysis in progress" },
  { label: "Evidence Verified", value: "16", note: "Evidence records checked" },
  { label: "On-chain Records", value: "12", note: "Avalanche Fuji" },
];

const cases = [
  {
    id: "TR-2026-001",
    title: "DeFi Transfer Dispute",
    network: "Avalanche Fuji",
    status: "Investigating",
    color: "text-amber-300",
  },
  {
    id: "TR-2026-002",
    title: "Missing Transaction Evidence",
    network: "Avalanche Fuji",
    status: "Review Pending",
    color: "text-blue-300",
  },
  {
    id: "TR-2026-003",
    title: "Unrecognized Transfer",
    network: "Avalanche Fuji",
    status: "Evidence Submitted",
    color: "text-emerald-300",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0c1423] p-6 md:block">
          <div className="mb-12">
            <h1 className="text-2xl font-bold tracking-wide">
              TRUST<span className="text-cyan-400">RECOVER</span>
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              AI-powered DeFi dispute intelligence
            </p>
          </div>

          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Workspace
          </p>

          <nav className="space-y-2 text-sm">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-300">
              ◈ Dashboard
            </div>
            <div className="rounded-xl px-4 py-3 text-slate-400">
              ▤ Dispute Cases
            </div>
            <div className="rounded-xl px-4 py-3 text-slate-400">
              ◉ Evidence Analysis
            </div>
            <div className="rounded-xl px-4 py-3 text-slate-400">
              ⛓ Avalanche Audit
            </div>
            <div className="rounded-xl px-4 py-3 text-slate-400">
              ⚙ Settings
            </div>
          </nav>

          <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-slate-500">NETWORK STATUS</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Avalanche Fuji
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Testnet environment
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-5 md:p-10">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">TRUSTRECOVER / Workspace</p>
              <h2 className="mt-2 text-3xl font-bold">Dashboard</h2>
              <p className="mt-2 text-sm text-slate-400">
                Monitor disputes, evidence and recovery progress.
              </p>
            </div>

            <a href="#workspace" className="inline-flex items-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300">
              + New Dispute
            </a>
          </header>

          <OnChainStatsAndCases />

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Recent Disputes</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Dispute case monitoring
                  </p>
                </div>
                <span className="text-xs text-cyan-300">View all →</span>
              </div>

              <div className="space-y-3">
                <p className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-xs text-slate-400">Tất cả hồ sơ tranh chấp đã xác minh được hiển thị trực tiếp từ Avalanche Fuji Smart Contract ở bảng On-Chain Anchored Cases phía trên.</p>
              </div>
              <p className="mt-4 text-xs text-amber-300">
                Demo preview: these cases are sample data, not on-chain records.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-6">
              <h3 className="text-lg font-semibold">AI Intelligence</h3>
              <p className="mt-1 text-xs text-slate-500">
                Dispute investigation pipeline
              </p>

              <div className="mt-6 space-y-5">
                {[
                  ["01", "AskPay", "Transaction verification"],
                  ["02", "DoubtStamp", "Evidence consistency analysis"],
                  ["03", "LEGALMIND", "Recovery guidance"],
                ].map(([number, name, description]) => (
                  <div key={number} className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-sm text-cyan-300">
                      {number}
                    </div>
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <p className="text-sm font-medium text-cyan-300">
                  Evidence-first recovery
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  AI investigates. Evidence is checked. Avalanche anchors an
                  auditable case history. Human reviewers validate outcomes.
                </p>
              </div>
            </div>
          </div>

          <div id="verifier"><FujiTransactionVerifier /></div>
          <div id="workspace"><DisputeIntelligenceWorkspace /></div>
          <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-600">
            TRUSTRECOVER © 2026 · AI-powered DeFi dispute intelligence
          </footer>
        </section>
      </div>
    </main>
  );
} 
