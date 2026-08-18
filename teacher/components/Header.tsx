export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Teacher Dashboard
        </h1>
        <p className="text-xs text-slate-500">
          English Placement Test
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-slate-900">
            Teacher
          </div>
          <div className="text-xs text-slate-500">
            Administrator
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
          T
        </div>
      </div>
    </header>
  );
}