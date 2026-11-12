import { Info } from "lucide-react";
import Card from "@/components/ui/Card";
import ExampleTag from "@/components/ui/ExampleTag";
import { demoUser } from "@/lib/demo-user";
import { examplePolicyHighlights } from "@/lib/mocks/examples";

export default function PolicyHighlightsPanel() {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Info className="h-4 w-4 text-accent" aria-hidden="true" />
        Policy highlights · Grade {demoUser.grade}
      </h2>
      <ExampleTag className="mt-3" />
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted marker:text-accent">
        {examplePolicyHighlights.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Card>
  );
}
