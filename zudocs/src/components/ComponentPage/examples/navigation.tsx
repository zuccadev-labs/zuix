// Navegación: pestañas, árboles, pasos y paginación con su estado local.
import useBaseUrl from "@docusaurus/useBaseUrl";
import {
  Accordion,
  Breadcrumb,
  Checkbox,
  Field,
  Input,
  Pagination,
  Radio,
  RadioGroup,
  Stepper,
  TabPanel,
  Tabs,
  Tree,
  type TreeNode,
} from "@zuccadev-labs/zuix-zui";
import { useEffect, useState } from "react";
import type { ExampleDemos } from "./shared";

const FILES: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: "folder",
    children: [
      { id: "src/index.ts", label: "index.ts", icon: "document" },
      { id: "src/app.tsx", label: "app.tsx", icon: "document" },
    ],
  },
  { id: "readme", label: "README.md", icon: "document" },
];

export const navigation: Record<string, ExampleDemos> = {
  Accordion: {
    "Preguntas frecuentes": () => (
      <Accordion
        defaultValue={["billing"]}
        items={[
          { value: "billing", title: "How does billing work?", content: <p>You are charged monthly, on the day you signed up.</p> },
          { value: "cancel", title: "Can I cancel anytime?", content: <p>Yes, from your account settings. No questions asked.</p> },
          { value: "seats", title: "Can I add more seats later?", content: <p>Seats are prorated for the rest of the month.</p> },
        ]}
      />
    ),
    "Tarjeta, siempre una abierta e item deshabilitado": () => (
      <Accordion
        variant="card"
        collapsible={false}
        defaultValue={["plan"]}
        items={[
          { value: "plan", title: "Plan", content: "Pro, billed yearly." },
          { value: "seats", title: "Seats", content: "12 of 20 in use." },
          { value: "sso", title: "Single sign-on", content: "Enterprise only.", disabled: true },
        ]}
      />
    ),
  },
  Breadcrumb: {
    "Colapsada con separador propio": () => {
      const home = useBaseUrl("/");
      return (
        <Breadcrumb
          maxItems={3}
          separator="/"
          items={[
            { label: "Home", href: home },
            { label: "Workspace", href: home },
            { label: "Projects", href: home },
            { label: "Atlas", href: home },
            { label: "Settings" },
          ]}
        />
      );
    },
  },
  Pagination: {
    Controlada: () => {
      const [page, setPage] = useState(1);
      return (
        <div className="zd-demo-stack zd-demo-stack--center">
          <Pagination page={page} pageCount={20} onPageChange={setPage} />
          <p className="zd-demo-hint">
            Showing results {(page - 1) * 10 + 1}–{page * 10} of 200
          </p>
        </div>
      );
    },
  },
  Stepper: {
    "Con paneles, iconos y carga": () => {
      const [step, setStep] = useState(0);
      const [deploying, setDeploying] = useState(false);
      useEffect(() => {
        if (step !== 2) return;
        setDeploying(true);
        const t = setTimeout(() => setDeploying(false), 1600);
        return () => clearTimeout(t);
      }, [step]);
      return (
        <Stepper
          current={step}
          onStepChange={setStep}
          nextDisabled={step === 2 && deploying}
          steps={[
            {
              label: "Account",
              icon: "user",
              content: (
                <Field label="Workspace name">
                  <Input defaultValue="Atlas" />
                </Field>
              ),
            },
            {
              label: "Plan",
              icon: "credit-card",
              content: (
                <RadioGroup aria-label="Plan" defaultValue="pro">
                  <Radio value="free">Free</Radio>
                  <Radio value="pro">Pro · $12 per seat</Radio>
                </RadioGroup>
              ),
            },
            {
              label: "Deploy",
              icon: "rocket-launch",
              loading: deploying,
              content: <p>{deploying ? "Deploying to eu-west…" : "Deployed to eu-west in 1.6 s."}</p>,
            },
          ]}
          completed={<p>All set.</p>}
        />
      );
    },
  },
  Tabs: {
    "Segmentado con contenido": () => (
      <Tabs
        label="Account sections"
        items={[
          { value: "overview", label: "Overview", content: <p>3 projects, 12 members, 1,204 requests this month.</p> },
          { value: "activity", label: "Activity", content: <p>Leo deployed Atlas 2 hours ago.</p> },
          { value: "settings", label: "Settings", icon: "cog", content: <Checkbox defaultChecked>Email me a weekly summary</Checkbox> },
        ]}
      />
    ),
    "Subrayado controlado con TabPanel": () => {
      const [tab, setTab] = useState("code");
      return (
        <Tabs
          variant="underline"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "code", label: "Code" },
            { value: "preview", label: "Preview" },
          ]}
        >
          <TabPanel value="code">Code view: the component source.</TabPanel>
          <TabPanel value="preview">Preview view: the component, live.</TabPanel>
        </Tabs>
      );
    },
  },
  Tree: {
    "Explorador de archivos": () => {
      const [open, setOpen] = useState<string>();
      return (
        <div className="zd-demo-stack">
          <Tree label="Project files" defaultExpanded={["src"]} onSelect={(id) => setOpen(id)} nodes={FILES} />
          <p className="zd-demo-hint">{open ? `Opened ${open}` : "Select a file to open it."}</p>
        </div>
      );
    },
    "Selección múltiple y casillas": () => {
      const [synced, setSynced] = useState<string[]>(["photos/2025"]);
      return (
        <div className="zd-demo-stack">
          <Tree
            label="Sync folders"
            selectionMode="multiple"
            checkable
            defaultExpanded={["photos"]}
            defaultChecked={["photos/2025"]}
            onCheckedChange={(ids) => setSynced(ids)}
            nodes={[
              {
                id: "photos",
                label: "Photos",
                icon: "folder",
                children: [
                  { id: "photos/2025", label: "2025", icon: "folder" },
                  { id: "photos/2026", label: "2026", icon: "folder" },
                ],
              },
              { id: "music", label: "Music", icon: "folder" },
            ]}
          />
          <p className="zd-demo-hint">Syncing: {synced.length ? synced.join(", ") : "nothing"}</p>
        </div>
      );
    },
    Renombrar: () => {
      const [files, setFiles] = useState(FILES);
      const rename = (id: string, label: string, nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => (n.id === id ? { ...n, label } : n.children ? { ...n, children: rename(id, label, n.children) } : n));
      return (
        <div className="zd-demo-stack">
          <Tree
            label="Files"
            renamable
            defaultExpanded={["src"]}
            onRename={(id, label) => setFiles((f) => rename(id, label, f))}
            nodes={files}
          />
          <p className="zd-demo-hint">Select a file and press F2 to rename it.</p>
        </div>
      );
    },
  },
};
