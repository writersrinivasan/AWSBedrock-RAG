"use client";

import { Assistant } from "@/components/Assistant";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { WorkshopProvider, useWorkshop } from "@/components/workshop";
import { Step1, Step2, Step3 } from "@/components/steps/StepsIntro";
import { Step4, Step5, Step6 } from "@/components/steps/StepsKb";
import { Step7 } from "@/components/steps/Step7Rag";
import { Step8, Step9, Step10 } from "@/components/steps/StepsOps";

const VIEWS = [Step1, Step2, Step3, Step4, Step5, Step6, Step7, Step8, Step9, Step10];

function Workshop() {
  const { step } = useWorkshop();
  const View = VIEWS[step - 1];
  return (
    <>
      <Header />
      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <Sidebar />
        <main className="min-w-0 pb-24">
          <View key={step} />
        </main>
      </div>
      <Assistant />
    </>
  );
}

export default function Page() {
  return (
    <WorkshopProvider>
      <Workshop />
    </WorkshopProvider>
  );
}
