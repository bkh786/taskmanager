const FEATURES = [
  {
    title: "Tasks that repeat themselves",
    body: "Daily, weekly or monthly schedules with weekday exclusions, reminders and a clear due date on every occurrence.",
    icon: ["M4 4v6h6", "M20 20v-6h-6", "M20 10a8 8 0 00-14-3L4 10", "M4 14a8 8 0 0014 3l2-3"],
  },
  {
    title: "Live dashboards",
    body: "See what is delayed, due today or pending across projects, people and reporting managers, at a glance.",
    icon: ["M3 3v18h18", "M7 14l4-4 4 4 5-6"],
  },
  {
    title: "Reports you can act on",
    body: "Filter by project, designation, role, status and assigner, then download exactly what you see as Excel.",
    icon: ["M6 2h9l5 5v15H6z", "M14 2v6h6", "M9 13h6", "M9 17h6"],
  },
  {
    title: "Team chat, built in",
    body: "Quick one-to-one messages inside your organization with live availability, replies, forwarding and read receipts.",
    icon: ["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", "M8 9h8", "M8 13h5"],
  },
  {
    title: "Your hierarchy, respected",
    body: "Managers see their reporting chain only. L1 and L2 managers can be copied on the notifications that matter.",
    icon: ["M12 3v6", "M5 21v-6a3 3 0 013-3h8a3 3 0 013 3v6", "M12 9a3 3 0 100-6 3 3 0 000 6z"],
  },
  {
    title: "Proof of completion",
    body: "Attach evidence when a task is done, so reviews are about the work rather than the follow-up.",
    icon: ["M20 6L9 17l-5-5"],
  },
];

/** The marketing half of the sign-in page (about 60% of the width on large screens). */
export function LoginShowcase() {
  return (
    <div
      className="hidden lg:flex relative overflow-hidden flex-col justify-center px-14 xl:px-20 py-12 text-white"
      style={{
        background:
          "radial-gradient(800px 500px at 90% -10%, rgba(10,132,255,0.38) 0%, transparent 62%), radial-gradient(600px 420px at 0% 110%, rgba(212,175,55,0.22) 0%, transparent 60%), linear-gradient(135deg, #0b0b0e 0%, #050505 100%)",
      }}
    >
      {/* soft shapes */}
      <div aria-hidden="true" className="absolute -left-24 -bottom-24 w-[380px] h-[380px] rounded-full" style={{ background: "rgba(212,175,55,0.10)" }} />
      <div aria-hidden="true" className="absolute right-10 bottom-10 w-[180px] h-[180px] rounded-full" style={{ background: "rgba(10,132,255,0.12)" }} />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative max-w-[760px]">
        <div className="text-[12px] font-semibold tracking-[0.18em] uppercase" style={{ color: "#D4AF37" }}>
          Task Manager
        </div>
        <h1 className="text-[40px] xl:text-[46px] leading-[1.08] font-extrabold mt-3">
          Get work done.
          <br />
          <span className="font-light" style={{ color: "#D4AF37" }}>And know it got done.</span>
        </h1>
        <p className="text-[15.5px] mt-4 max-w-[560px] opacity-90">
          One place for assigning, tracking and proving every task across your teams, with the
          reporting, reminders and conversations around it.
        </p>

        <div className="grid grid-cols-2 gap-3.5 mt-9">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-4 border bg-white/[0.06]" style={{ borderColor: "rgba(255,255,255,0.14)" }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: "rgba(212,175,55,0.16)", color: "#D4AF37" }}>
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {f.icon.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
              </div>
              <div className="text-[14.5px] font-bold">{f.title}</div>
              <div className="text-[12.5px] mt-1 opacity-85 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
