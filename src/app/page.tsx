
import { KhmerEzCard } from "@/components/khmer-ez-card";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 font-body pt-24">
      <div className="flex flex-col items-center justify-center space-y-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-headline">
          KhmerEZ
        </h1>
        <p className="max-w-md text-muted-foreground text-xs">
          @RSM
        </p>
      </div>
      <KhmerEzCard />
    </main>
  );
}
