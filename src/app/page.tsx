export default function HomePage() {
  return (
    <main className="flex min-h-full flex-col">
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-teal-500 to-cyan-400" />
      <div className="flex flex-1 items-center justify-center p-6">
        <section className="card w-full max-w-md p-8 text-center">
          <p className="eyebrow">Omni Dental</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">OmniScripts ISA</h1>
          <p className="mt-3 text-sm text-slate-500">
            Guiones de llamada sincronizados con la Master Operativa. En construcción.
          </p>
        </section>
      </div>
    </main>
  );
}
