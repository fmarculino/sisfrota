export default function Home() {
  return (
    <main className="min-h-screen bg-ink text-td flex flex-col">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-green/15 text-brand-green font-display font-extrabold">
            S
          </div>
          <span className="font-display text-sm font-semibold tracking-wide text-td">
            SisFrota
          </span>
        </div>
        <span className="rounded-full border border-line px-3 py-1 font-mono-brand text-[11px] uppercase tracking-[0.2em] text-brand-amber">
          Em desenvolvimento
        </span>
      </header>

      <section className="flex flex-1 flex-col justify-center px-6 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-4 flex items-center gap-3 font-mono-brand text-xs uppercase tracking-[0.22em] text-brand-green">
            <span>Secretaria Municipal de Saúde de Marabá/PA</span>
            <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
          </p>

          <h1 className="mb-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-td sm:text-5xl">
            Gestão da frota da Secretaria Municipal de Saúde
          </h1>

          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-td-2">
            O SisFrota vai registrar abastecimentos, leituras de odômetro e o uso dos
            veículos da secretaria, gerando um histórico auditável — cada registro
            aqui pode virar peça de prestação de contas ao Tribunal de Contas.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Feature
              title="Abastecimentos"
              description="Registro de combustível por veículo, com evidência e conferência."
            />
            <Feature
              title="Odômetro"
              description="Leituras de campo comparadas ao histórico, com anomalias sinalizadas."
            />
            <Feature
              title="Auditoria"
              description="Trilha de dados que não se apaga nem se sobrescreve — só se anota."
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-6 text-xs text-td-2 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Sistema em fase de planejamento e desenvolvimento — nenhum dado real em
            produção ainda.
          </span>
          <span className="font-mono-brand">sisfrota.vps.atb.app.br</span>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-2 p-4">
      <h3 className="mb-1.5 font-display text-sm font-bold text-td">{title}</h3>
      <p className="text-sm leading-relaxed text-td-2">{description}</p>
    </div>
  );
}
