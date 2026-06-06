import { Suspense } from "react";
import Rail from "@/components/shell/Rail";
import Header from "@/components/shell/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas bg-canvas-grad">
      <Suspense fallback={<aside className="fixed inset-y-0 left-0 w-[224px] bg-rail-grad" />}>
        <Rail />
      </Suspense>
      <div className="pl-[224px]">
        <Suspense fallback={<div className="h-24" />}>
          <Header />
        </Suspense>
        <main className="px-8 pb-12 pt-6">{children}</main>
      </div>
    </div>
  );
}
